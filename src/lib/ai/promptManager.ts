/**
 * AI Prompt Manager
 * Fetches and caches AI prompts from the database
 */

import { createAdminClient } from '@/lib/supabase/admin';

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
 * Get prompt template with variables replaced
 */
export async function getPromptWithVariables(
  key: string,
  variables: Record<string, string>
): Promise<{ prompt: string; schema: string | null } | null> {
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

  return { prompt, schema };
}

/**
 * Update a prompt
 */
export async function updatePrompt(
  id: string,
  updates: {
    prompt_template: string;
    schema_template?: string | null;
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

  // Save to history
  await supabase.from('ai_prompt_history').insert({
    prompt_id: id,
    prompt_template: current.prompt_template,
    schema_template: current.schema_template,
    version: current.version,
    changed_by: userId,
    change_reason: changeReason || 'Updated via settings',
  });

  // Update the prompt
  const { error: updateError } = await supabase
    .from('ai_prompts')
    .update({
      prompt_template: updates.prompt_template,
      schema_template: updates.schema_template,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
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
