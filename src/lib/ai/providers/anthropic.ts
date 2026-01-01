/**
 * Anthropic (Claude) Provider
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ProviderRequest, ProviderResponse } from './types';

// Lazily initialize Anthropic client
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Call Anthropic Claude API
 */
export async function callAnthropic(request: ProviderRequest): Promise<ProviderResponse> {
  const startTime = Date.now();

  const response = await getClient().messages.create({
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.systemPrompt || undefined,
    messages: [{ role: 'user', content: request.prompt }],
    ...(request.temperature !== undefined && { temperature: request.temperature }),
  });

  const textContent = response.content.find((c) => c.type === 'text');

  return {
    content: textContent?.text || '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model: request.model,
    provider: 'anthropic',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Stream response from Anthropic Claude API
 */
export async function streamAnthropic(
  request: ProviderRequest,
  onChunk: (chunk: string) => void
): Promise<ProviderResponse> {
  const startTime = Date.now();

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = getClient().messages.stream({
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.systemPrompt || undefined,
    messages: [{ role: 'user', content: request.prompt }],
    ...(request.temperature !== undefined && { temperature: request.temperature }),
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
    model: request.model,
    provider: 'anthropic',
    latencyMs: Date.now() - startTime,
  };
}
