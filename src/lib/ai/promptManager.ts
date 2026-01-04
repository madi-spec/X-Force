/**
 * AI Prompt Manager
 * Fetches and caches AI prompts from the database
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type Provider = 'anthropic' | 'openai' | 'gemini';

export interface AIPrompt {
  id: string;
  key: string;
  name: string;
  description: string | null;
  prompt_template: string;
  schema_template: string | null;
  default_prompt_template: string;
  default_schema_template: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  // Model/token configuration
  model: string;
  max_tokens: number;
  category: string | null;
  purpose: string | null;
  variables: string[] | null;
  // Provider configuration
  provider: Provider;
  fallback_provider: Provider | null;
  fallback_model: string | null;
}

// In-memory cache for prompts (refreshes every 5 minutes)
const promptCache: Map<string, { prompt: AIPrompt; cachedAt: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a prompt by its key
 */
export async function getPrompt(key: string): Promise<AIPrompt | null> {
  // Check cache first
  const cached = promptCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.prompt;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('key', key)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error(`[PromptManager] Failed to fetch prompt "${key}":`, error?.message);
    return null;
  }

  // Cache the prompt
  promptCache.set(key, { prompt: data as AIPrompt, cachedAt: Date.now() });

  return data as AIPrompt;
}

/**
 * Get all prompts
 */
export async function getAllPrompts(): Promise<AIPrompt[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .order('name');

  if (error) {
    console.error('[PromptManager] Failed to fetch prompts:', error.message);
    return [];
  }

  return (data || []) as AIPrompt[];
}

/**
 * Get default model for a provider
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
 * Get prompt template with variables replaced
 * Returns the prompt, schema, model, maxTokens, provider, and fallback for use with the AI client
 */
export async function getPromptWithVariables(
  key: string,
  variables: Record<string, string>
): Promise<{
  prompt: string;
  schema: string | null;
  model: string;
  maxTokens: number;
  provider: Provider;
  fallback?: {
    provider: Provider;
    model: string;
  };
} | null> {
  const promptData = await getPrompt(key);
  if (!promptData) return null;

  let prompt = promptData.prompt_template;
  let schema = promptData.schema_template;

  // Replace variables in the format {{variableName}}
  for (const [varName, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
    prompt = prompt.replace(regex, value);
    if (schema) {
      schema = schema.replace(regex, value);
    }
  }

  const provider = promptData.provider || 'anthropic';

  return {
    prompt,
    schema,
    model: promptData.model || getDefaultModelForProvider(provider),
    maxTokens: promptData.max_tokens || 4096,
    provider,
    fallback: promptData.fallback_provider
      ? {
          provider: promptData.fallback_provider,
          model: promptData.fallback_model || getDefaultModelForProvider(promptData.fallback_provider),
        }
      : undefined,
  };
}

/**
 * Update a prompt
 */
export async function updatePrompt(
  id: string,
  updates: {
    prompt_template: string;
    schema_template?: string | null;
    model?: string;
    max_tokens?: number;
    provider?: Provider;
    fallback_provider?: Provider | null;
    fallback_model?: string | null;
  },
  userId: string,
  changeReason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Get current prompt for history
  const { data: current, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return { success: false, error: 'Prompt not found' };
  }

  // Save to history (including model/max_tokens/provider for tracking)
  await supabase.from('ai_prompt_history').insert({
    prompt_id: id,
    prompt_template: current.prompt_template,
    schema_template: current.schema_template,
    model: current.model,
    max_tokens: current.max_tokens,
    provider: current.provider,
    fallback_provider: current.fallback_provider,
    fallback_model: current.fallback_model,
    version: current.version,
    changed_by: userId,
    change_reason: changeReason || 'Updated via settings',
  });

  // Build update object - only include fields that are provided
  const updateData: Record<string, unknown> = {
    prompt_template: updates.prompt_template,
    version: current.version + 1,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (updates.schema_template !== undefined) {
    updateData.schema_template = updates.schema_template;
  }
  if (updates.model !== undefined) {
    updateData.model = updates.model;
  }
  if (updates.max_tokens !== undefined) {
    updateData.max_tokens = updates.max_tokens;
  }
  if (updates.provider !== undefined) {
    updateData.provider = updates.provider;
  }
  if (updates.fallback_provider !== undefined) {
    updateData.fallback_provider = updates.fallback_provider;
  }
  if (updates.fallback_model !== undefined) {
    updateData.fallback_model = updates.fallback_model;
  }

  // Update the prompt
  const { error: updateError } = await supabase
    .from('ai_prompts')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Clear cache for this prompt
  promptCache.delete(current.key);

  return { success: true };
}

/**
 * Revert a prompt to a previous version
 */
export async function revertPromptToVersion(
  promptId: string,
  version: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Get the historical version
  const { data: historyEntry, error: historyError } = await supabase
    .from('ai_prompt_history')
    .select('*')
    .eq('prompt_id', promptId)
    .eq('version', version)
    .single();

  if (historyError || !historyEntry) {
    return { success: false, error: 'Version not found' };
  }

  return updatePrompt(
    promptId,
    {
      prompt_template: historyEntry.prompt_template,
      schema_template: historyEntry.schema_template,
    },
    userId,
    `Reverted to version ${version}`
  );
}

/**
 * Revert a prompt to its default
 */
export async function revertPromptToDefault(
  promptId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Get the prompt with default values
  const { data: prompt, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('default_prompt_template, default_schema_template')
    .eq('id', promptId)
    .single();

  if (fetchError || !prompt) {
    return { success: false, error: 'Prompt not found' };
  }

  return updatePrompt(
    promptId,
    {
      prompt_template: prompt.default_prompt_template,
      schema_template: prompt.default_schema_template,
    },
    userId,
    'Reverted to default'
  );
}

/**
 * Get prompt history
 */
export async function getPromptHistory(
  promptId: string
): Promise<Array<{
  id: string;
  version: number;
  changed_at: string;
  changed_by: string | null;
  change_reason: string | null;
}>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('ai_prompt_history')
    .select('id, version, changed_at, changed_by, change_reason')
    .eq('prompt_id', promptId)
    .order('version', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[PromptManager] Failed to fetch history:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Clear the prompt cache (useful after updates)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Get prompt with fallback key pattern
 * Tries specific key first, then falls back to base key
 * Example: getPromptWithFallback('email_followup_stalled', 'pest-control')
 *   -> tries 'email_followup_stalled__pest-control' first
 *   -> falls back to 'email_followup_stalled'
 */
export async function getPromptWithFallback(
  baseKey: string,
  overrideSuffix?: string | null
): Promise<AIPrompt | null> {
  // Try specific key first if suffix provided
  if (overrideSuffix) {
    const specificKey = `${baseKey}__${overrideSuffix}`;
    const specificPrompt = await getPrompt(specificKey);
    if (specificPrompt) {
      return specificPrompt;
    }
  }

  // Fall back to base key
  return getPrompt(baseKey);
}

/**
 * Get prompt with process-type suffix, falling back to base prompt if not found
 * Returns the processed prompt with variables substituted and tracks which key was used.
 *
 * Example: getPromptWithProcessFallback('transcript_analysis', 'onboarding', variables)
 * - First tries: 'transcript_analysis__onboarding'
 * - Falls back to: 'transcript_analysis'
 *
 * @param baseKey - Base prompt key (e.g., 'transcript_analysis')
 * @param suffix - Process type suffix (e.g., 'onboarding')
 * @param variables - Variables to substitute in the prompt
 */
export async function getPromptWithProcessFallback(
  baseKey: string,
  suffix: string | null,
  variables: Record<string, string> = {}
): Promise<{
  prompt: string;
  schema: string | null;
  model: string;
  maxTokens: number;
  provider: Provider;
  usedKey: string;
  fallback?: {
    provider: Provider;
    model: string;
  };
} | null> {
  // Try process-specific prompt first
  if (suffix) {
    const specificKey = `${baseKey}__${suffix}`;
    const specificPrompt = await getPromptWithVariables(specificKey, variables);
    if (specificPrompt) {
      return {
        ...specificPrompt,
        usedKey: specificKey,
      };
    }
    console.log(`[PromptManager] No prompt found for "${specificKey}", falling back to "${baseKey}"`);
  }

  // Fall back to base prompt
  const basePrompt = await getPromptWithVariables(baseKey, variables);
  if (basePrompt) {
    return {
      ...basePrompt,
      usedKey: baseKey,
    };
  }

  console.error(`[PromptManager] No prompt found for base key "${baseKey}"`);
  return null;
}

/**
 * Email draft output structure
 */
export interface EmailDraftOutput {
  subject: string;
  body: string;
  quality_checks: {
    used_contact_name: boolean;
    referenced_prior_interaction: boolean;
  };
}

/**
 * Generate an email draft using a prompt from ai_prompts
 *
 * @param promptKey - Base prompt key (e.g., 'email_followup_stalled')
 * @param variables - Variables to inject into the prompt template
 * @param options - Additional options
 * @returns Parsed email draft with subject, body, and quality checks
 */
export async function generateEmailFromPromptKey(
  promptKey: string,
  variables: Record<string, string>,
  options?: {
    productSlug?: string | null; // For product-specific prompt override
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<EmailDraftOutput> {
  // Dynamic import to avoid circular dependency
  const { callAIJson } = await import('@/lib/ai/core/aiClient');

  // Try to get prompt with product-specific override
  const prompt = await getPromptWithFallback(promptKey, options?.productSlug);

  if (!prompt) {
    throw new Error(`Prompt not found: ${promptKey}`);
  }

  // Replace variables in the template
  let promptText = prompt.prompt_template;
  let schemaText = prompt.schema_template;

  for (const [varName, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
    promptText = promptText.replace(regex, value || '');
    if (schemaText) {
      schemaText = schemaText.replace(regex, value || '');
    }
  }

  // Call AI with the prompt
  const result = await callAIJson<EmailDraftOutput>({
    prompt: promptText,
    schema: schemaText || undefined,
    model: (options?.model || prompt.model || 'claude-sonnet-4-20250514') as 'claude-sonnet-4-20250514',
    maxTokens: options?.maxTokens || prompt.max_tokens || 1000,
    temperature: options?.temperature ?? 0.7,
  });

  // Ensure quality_checks exists with defaults
  const draft = result.data;
  if (!draft.quality_checks) {
    draft.quality_checks = {
      used_contact_name: !!variables.contact_name && variables.contact_name !== 'there',
      referenced_prior_interaction: !!(variables.last_inbound || variables.last_outbound),
    };
  }

  return draft;
}
