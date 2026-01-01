/**
 * AI Client
 * Multi-provider AI client with fallback support
 */

import { getPrompt } from '@/lib/ai/promptManager';
import {
  callAnthropic,
  streamAnthropic,
  callOpenAI,
  streamOpenAI,
  callGemini,
  streamGemini,
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
  getDefaultModelForProvider,
} from '@/lib/ai/providers';

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  provider?: Provider;
  fallback?: {
    provider: Provider;
    model: string;
  };
}

export interface AIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  provider: Provider;
  latencyMs: number;
  usedFallback?: boolean;
}

export interface AIJsonRequest<T> extends AIRequest {
  schema?: string;
}

// Fallback system prompt (used if DB fetch fails)
const FALLBACK_SYSTEM_PROMPT = `You are an expert AI sales assistant for X-FORCE, a CRM for the pest control and lawn care industry.

Your role is to:
- Analyze sales conversations, emails, and meetings
- Provide actionable insights and recommendations
- Draft professional communications
- Identify risks and opportunities
- Help sales reps close more deals

Industry context:
- Customers are pest control and lawn care companies
- They buy phone systems (Voice for Pest) and AI solutions (X-RAI)
- Decision makers are typically owners, operations managers, or call center managers
- Common pain points: missed calls, after-hours coverage, call center efficiency, customer retention
- Products include: Voice phone system, X-RAI platform (call analytics), AI Agents (receptionist, dispatch, sales)

Always be:
- Specific and actionable (not generic advice)
- Data-driven (reference actual information from context)
- Professional but warm in tone
- Focused on helping close deals

When generating JSON, respond ONLY with valid JSON, no markdown or extra text.`;

// Cache for the system prompt
let cachedSystemPrompt: { prompt: string; fetchedAt: number } | null = null;
const SYSTEM_PROMPT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the default system prompt from the database (with caching)
 */
async function getDefaultSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt && Date.now() - cachedSystemPrompt.fetchedAt < SYSTEM_PROMPT_CACHE_TTL) {
    return cachedSystemPrompt.prompt;
  }

  try {
    const promptData = await getPrompt('core_system');
    if (promptData) {
      cachedSystemPrompt = {
        prompt: promptData.prompt_template,
        fetchedAt: Date.now(),
      };
      return promptData.prompt_template;
    }
  } catch (error) {
    console.error('[AIClient] Failed to fetch core_system prompt from DB:', error);
  }

  return FALLBACK_SYSTEM_PROMPT;
}

/**
 * Call a specific provider
 */
async function callProvider(
  provider: Provider,
  request: ProviderRequest
): Promise<ProviderResponse> {
  console.log(`[AI] Calling ${provider} with model ${request.model}`);

  switch (provider) {
    case 'anthropic':
      return callAnthropic(request);
    case 'openai':
      return callOpenAI(request);
    case 'gemini':
      return callGemini(request);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Stream from a specific provider
 */
async function streamProvider(
  provider: Provider,
  request: ProviderRequest,
  onChunk: (chunk: string) => void
): Promise<ProviderResponse> {
  console.log(`[AI] Streaming from ${provider} with model ${request.model}`);

  switch (provider) {
    case 'anthropic':
      return streamAnthropic(request, onChunk);
    case 'openai':
      return streamOpenAI(request, onChunk);
    case 'gemini':
      return streamGemini(request, onChunk);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Core AI call function - supports multiple providers with fallback
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const provider = request.provider || 'anthropic';
  const model = request.model || getDefaultModelForProvider(provider);
  const systemPrompt = request.systemPrompt || await getDefaultSystemPrompt();
  const maxTokens = request.maxTokens || 4000;

  const providerRequest: ProviderRequest = {
    prompt: request.prompt,
    systemPrompt,
    model,
    maxTokens,
    temperature: request.temperature,
  };

  try {
    const response = await callProvider(provider, providerRequest);
    return {
      ...response,
      usedFallback: false,
    };
  } catch (error) {
    console.error(`[AI] ${provider} failed:`, error);

    // Try fallback if configured
    if (request.fallback) {
      console.log(`[AI] Trying fallback: ${request.fallback.provider}/${request.fallback.model}`);

      try {
        const fallbackRequest: ProviderRequest = {
          ...providerRequest,
          model: request.fallback.model,
        };

        const fallbackResponse = await callProvider(request.fallback.provider, fallbackRequest);
        return {
          ...fallbackResponse,
          usedFallback: true,
        };
      } catch (fallbackError) {
        console.error(`[AI] Fallback also failed:`, fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * Call AI and parse JSON response
 */
export async function callAIJson<T>(request: AIJsonRequest<T>): Promise<{
  data: T;
  usage: AIResponse['usage'];
  latencyMs: number;
  provider: Provider;
  usedFallback?: boolean;
}> {
  const enhancedPrompt = request.schema
    ? `${request.prompt}\n\nRespond with valid JSON matching this structure:\n${request.schema}`
    : request.prompt;

  const response = await callAI({
    ...request,
    prompt: enhancedPrompt,
  });

  // Clean up response - remove markdown code blocks if present
  let jsonContent = response.content.trim();
  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.slice(7);
  }
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.slice(3);
  }
  if (jsonContent.endsWith('```')) {
    jsonContent = jsonContent.slice(0, -3);
  }
  jsonContent = jsonContent.trim();

  // Try to extract just the first JSON object if there's extra text after it
  const extractFirstJson = (text: string): string => {
    const start = text.indexOf('{');
    if (start === -1) return text;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') depth++;
        else if (char === '}') {
          depth--;
          if (depth === 0) {
            return text.substring(start, i + 1);
          }
        }
      }
    }

    return text;
  };

  try {
    const data = JSON.parse(jsonContent) as T;
    return {
      data,
      usage: response.usage,
      latencyMs: response.latencyMs,
      provider: response.provider,
      usedFallback: response.usedFallback,
    };
  } catch (error) {
    // Try extracting just the first JSON object
    try {
      const firstJson = extractFirstJson(jsonContent);
      const data = JSON.parse(firstJson) as T;
      console.log('[callAIJson] Extracted first JSON object from response with trailing text');
      return {
        data,
        usage: response.usage,
        latencyMs: response.latencyMs,
        provider: response.provider,
        usedFallback: response.usedFallback,
      };
    } catch {
      console.error('Failed to parse AI JSON response:', jsonContent);
      throw new Error(`Failed to parse AI response as JSON: ${error}`);
    }
  }
}

/**
 * Call AI with streaming (for longer responses)
 */
export async function callAIStream(
  request: AIRequest,
  onChunk: (chunk: string) => void
): Promise<AIResponse> {
  const provider = request.provider || 'anthropic';
  const model = request.model || getDefaultModelForProvider(provider);
  const systemPrompt = request.systemPrompt || await getDefaultSystemPrompt();
  const maxTokens = request.maxTokens || 4000;

  const providerRequest: ProviderRequest = {
    prompt: request.prompt,
    systemPrompt,
    model,
    maxTokens,
    temperature: request.temperature,
  };

  try {
    const response = await streamProvider(provider, providerRequest, onChunk);
    return {
      ...response,
      usedFallback: false,
    };
  } catch (error) {
    console.error(`[AI] ${provider} streaming failed:`, error);

    // Try fallback if configured
    if (request.fallback) {
      console.log(`[AI] Trying streaming fallback: ${request.fallback.provider}/${request.fallback.model}`);

      try {
        const fallbackRequest: ProviderRequest = {
          ...providerRequest,
          model: request.fallback.model,
        };

        const fallbackResponse = await streamProvider(request.fallback.provider, fallbackRequest, onChunk);
        return {
          ...fallbackResponse,
          usedFallback: true,
        };
      } catch (fallbackError) {
        console.error(`[AI] Streaming fallback also failed:`, fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * Get a quick/cheap AI response (using Haiku for Anthropic)
 */
export async function callAIQuick(request: Omit<AIRequest, 'model'>): Promise<AIResponse> {
  const provider = request.provider || 'anthropic';

  // Use the fastest/cheapest model for each provider
  const quickModels: Record<Provider, string> = {
    anthropic: 'claude-3-haiku-20240307',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-1.5-flash',
  };

  return callAI({
    ...request,
    model: quickModels[provider],
    maxTokens: request.maxTokens || 1000,
  });
}

/**
 * Log AI usage for tracking/billing
 */
export async function logAIUsage(
  supabase: any,
  params: {
    insightType: string;
    dealId?: string;
    companyId?: string;
    contactId?: string;
    userId?: string;
    usage: AIResponse['usage'];
    latencyMs: number;
    model: string;
    provider?: Provider;
    data?: any;
  }
): Promise<void> {
  try {
    await supabase.from('ai_insights_log').insert({
      insight_type: params.insightType,
      deal_id: params.dealId || null,
      company_id: params.companyId || null,
      contact_id: params.contactId || null,
      user_id: params.userId || null,
      model_used: params.model,
      tokens_input: params.usage.inputTokens,
      tokens_output: params.usage.outputTokens,
      latency_ms: params.latencyMs,
      insight_data: params.data || {},
    });
  } catch (error) {
    console.error('Failed to log AI usage:', error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}

// Re-export Provider type for convenience
export type { Provider } from '@/lib/ai/providers';
