import Anthropic from '@anthropic-ai/sdk';
import { getPrompt } from '@/lib/ai/promptManager';

// Lazily initialize Anthropic client (to support scripts that load env after import)
let _anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307' | 'claude-opus-4-20250514';
}

export interface AIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  latencyMs: number;
}

export interface AIJsonRequest<T> extends AIRequest {
  schema?: string; // Description of expected JSON structure
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
  // Check cache
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
 * Core AI call function
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const startTime = Date.now();

  const model = request.model || 'claude-sonnet-4-20250514';
  const systemPrompt = request.systemPrompt || await getDefaultSystemPrompt();

  const response = await getAnthropicClient().messages.create({
    model,
    max_tokens: request.maxTokens || 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: request.prompt }],
    ...(request.temperature !== undefined && { temperature: request.temperature }),
  });

  const textContent = response.content.find((c) => c.type === 'text');
  const latencyMs = Date.now() - startTime;

  return {
    content: textContent?.text || '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model,
    latencyMs,
  };
}

/**
 * Call AI and parse JSON response
 */
export async function callAIJson<T>(request: AIJsonRequest<T>): Promise<{
  data: T;
  usage: AIResponse['usage'];
  latencyMs: number;
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
  // This handles cases where the AI adds explanation text after the JSON
  const extractFirstJson = (text: string): string => {
    // Find the first { and track brace depth to find the matching }
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

    return text; // Return original if no complete JSON found
  };

  try {
    const data = JSON.parse(jsonContent) as T;
    return {
      data,
      usage: response.usage,
      latencyMs: response.latencyMs,
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
  const startTime = Date.now();
  const model = request.model || 'claude-sonnet-4-20250514';
  const systemPrompt = request.systemPrompt || await getDefaultSystemPrompt();

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = getAnthropicClient().messages.stream({
    model,
    max_tokens: request.maxTokens || 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: request.prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      onChunk(event.delta.text);
    }
    if (event.type === 'message_delta' && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
    if (event.type === 'message_start' && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
  }

  return {
    content: fullContent,
    usage: {
      inputTokens,
      outputTokens,
    },
    model,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Get a quick/cheap AI response (using Haiku)
 */
export async function callAIQuick(request: Omit<AIRequest, 'model'>): Promise<AIResponse> {
  return callAI({
    ...request,
    model: 'claude-3-haiku-20240307',
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
