/**
 * AI Provider Types
 * Shared types for multi-provider AI support
 */

export type Provider = 'anthropic' | 'openai' | 'gemini';

export interface ProviderRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  maxTokens: number;
  temperature?: number;
}

export interface ProviderResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  provider: Provider;
  latencyMs: number;
}

/**
 * Get the default model for a provider
 */
export function getDefaultModelForProvider(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-20250514';
    case 'openai':
      return 'gpt-4o';
    case 'gemini':
      return 'gemini-1.5-pro';
    default:
      return 'claude-sonnet-4-20250514';
  }
}

/**
 * Get available models for a provider
 */
export function getModelsForProvider(provider: Provider): Array<{ id: string; name: string; description: string }> {
  switch (provider) {
    case 'anthropic':
      return [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance of speed and quality' },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable, highest quality' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest, most economical' },
      ];
    case 'openai':
      return [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT model' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship' },
      ];
    case 'gemini':
      return [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable Gemini model' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
      ];
    default:
      return [];
  }
}
