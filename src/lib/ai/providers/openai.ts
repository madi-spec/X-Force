/**
 * OpenAI (GPT) Provider
 */

import type { ProviderRequest, ProviderResponse } from './types';

// Lazily initialize OpenAI client
let client: any = null;
let OpenAI: any = null;

async function getClient(): Promise<any> {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Dynamic import to avoid issues if package not installed
    try {
      const openaiModule = await import('openai');
      OpenAI = openaiModule.default;
      client = new OpenAI();
    } catch (error) {
      throw new Error('OpenAI SDK not installed. Run: npm install openai');
    }
  }
  return client;
}

/**
 * Call OpenAI GPT API
 */
export async function callOpenAI(request: ProviderRequest): Promise<ProviderResponse> {
  const startTime = Date.now();
  const openai = await getClient();

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }
  messages.push({ role: 'user', content: request.prompt });

  const response = await openai.chat.completions.create({
    model: request.model,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    messages,
  });

  return {
    content: response.choices[0]?.message?.content || '',
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    },
    model: request.model,
    provider: 'openai',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Stream response from OpenAI GPT API
 */
export async function streamOpenAI(
  request: ProviderRequest,
  onChunk: (chunk: string) => void
): Promise<ProviderResponse> {
  const startTime = Date.now();
  const openai = await getClient();

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }
  messages.push({ role: 'user', content: request.prompt });

  const stream = await openai.chat.completions.create({
    model: request.model,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    messages,
    stream: true,
  });

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullContent += delta;
      onChunk(delta);
    }
    // OpenAI streaming doesn't provide token counts per chunk
    // We estimate based on final content
  }

  // Rough token estimation for streaming (OpenAI doesn't provide in stream)
  inputTokens = Math.ceil(request.prompt.length / 4);
  outputTokens = Math.ceil(fullContent.length / 4);

  return {
    content: fullContent,
    usage: {
      inputTokens,
      outputTokens,
    },
    model: request.model,
    provider: 'openai',
    latencyMs: Date.now() - startTime,
  };
}
