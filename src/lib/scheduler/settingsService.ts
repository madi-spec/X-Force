/**
 * Scheduler Settings Service
 *
 * Manages configuration for scheduler behavior including:
 * - Channel strategy settings
 * - Reputation guardrails
 * - Meeting defaults
 * - Email settings
 * - Availability settings
 * - Automation settings
 */

import { createClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

export interface ChannelSettings {
  default_start_channel: 'email' | 'sms' | 'phone';
  escalation_enabled: boolean;
  escalation_after_attempts: number;
  escalation_after_days: number;
  sms_enabled: boolean;
  phone_enabled: boolean;
  max_attempts_per_channel: number;
}

export interface GuardrailSettings {
  default_daily_limit: number;
  default_weekly_limit: number;
  default_monthly_limit: number;
  cool_off_days_after_meeting: number;
  cool_off_days_after_rejection: number;
  respect_opt_outs: boolean;
}

export interface MeetingTypeDefaults {
  duration: number;
  buffer_before: number;
  buffer_after: number;
}

export interface MeetingDefaults {
  discovery: MeetingTypeDefaults;
  demo: MeetingTypeDefaults;
  follow_up: MeetingTypeDefaults;
  technical: MeetingTypeDefaults;
  executive: MeetingTypeDefaults;
  [key: string]: MeetingTypeDefaults;
}

export interface EmailSettings {
  from_name_format: string;
  include_social_proof: boolean;
  max_time_slots_to_offer: number;
  include_calendar_link: boolean;
  signature_style: 'professional' | 'casual' | 'minimal';
}

export interface AvailabilitySettings {
  working_hours_start: string; // HH:MM format
  working_hours_end: string;
  working_days: string[];
  timezone: string;
  slot_duration_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
}

export interface AutomationSettings {
  auto_send_reminders: boolean;
  reminder_hours_before: number[];
  auto_detect_responses: boolean;
  auto_confirm_meetings: boolean;
  no_show_follow_up_enabled: boolean;
  no_show_wait_minutes: number;
}

export interface SchedulerSettings {
  channel_settings: ChannelSettings;
  guardrail_settings: GuardrailSettings;
  meeting_defaults: MeetingDefaults;
  email_settings: EmailSettings;
  availability_settings: AvailabilitySettings;
  automation_settings: AutomationSettings;
}

export interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  template_type: string;
  meeting_type: string | null;
  subject_template: string;
  body_template: string;
  available_variables: string[];
  tone: string;
  is_variant: boolean;
  parent_template_id: string | null;
  variant_name: string | null;
  variant_weight: number;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeasonalityOverride {
  id: string;
  start_date: string;
  end_date: string;
  override_type: string;
  name: string;
  description: string | null;
  adjustments: {
    patience_multiplier: number;
    reduce_frequency: boolean;
    pause_outreach: boolean;
    custom_message: string | null;
  };
  applies_to_industries: string[] | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialProofEntry {
  id: string;
  proof_type: string;
  title: string;
  content: string;
  short_version: string | null;
  source_company: string | null;
  source_person: string | null;
  source_title: string | null;
  target_industries: string[] | null;
  target_company_sizes: string[] | null;
  target_personas: string[] | null;
  metric_value: string | null;
  metric_label: string | null;
  logo_url: string | null;
  image_url: string | null;
  times_used: number;
  conversion_count: number;
  is_active: boolean;
  is_verified: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================

/**
 * Get scheduler settings for a user (or global defaults)
 */
export async function getSchedulerSettings(userId?: string): Promise<SchedulerSettings> {
  const supabase = await createClient();

  // Use the database function to get merged settings
  const { data, error } = await supabase.rpc('get_scheduler_settings', {
    p_user_id: userId || null,
  });

  if (error) {
    console.error('[Settings] Error fetching settings:', error);
    throw new Error('Failed to fetch scheduler settings');
  }

  return data as SchedulerSettings;
}

/**
 * Update scheduler settings
 */
export async function updateSchedulerSettings(
  settings: Partial<SchedulerSettings>,
  userId?: string
): Promise<SchedulerSettings> {
  const supabase = await createClient();

  // Build update object
  const updateData: Record<string, unknown> = {};
  if (settings.channel_settings) updateData.channel_settings = settings.channel_settings;
  if (settings.guardrail_settings) updateData.guardrail_settings = settings.guardrail_settings;
  if (settings.meeting_defaults) updateData.meeting_defaults = settings.meeting_defaults;
  if (settings.email_settings) updateData.email_settings = settings.email_settings;
  if (settings.availability_settings) updateData.availability_settings = settings.availability_settings;
  if (settings.automation_settings) updateData.automation_settings = settings.automation_settings;

  if (userId) {
    // Upsert user-specific settings
    const { error } = await supabase
      .from('scheduler_settings')
      .upsert({
        user_id: userId,
        ...updateData,
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error('[Settings] Error updating user settings:', error);
      throw new Error('Failed to update settings');
    }
  } else {
    // Update global settings
    const { error } = await supabase
      .from('scheduler_settings')
      .update(updateData)
      .is('user_id', null);

    if (error) {
      console.error('[Settings] Error updating global settings:', error);
      throw new Error('Failed to update settings');
    }
  }

  return getSchedulerSettings(userId);
}

/**
 * Reset user settings to global defaults
 */
export async function resetUserSettings(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduler_settings')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('[Settings] Error resetting user settings:', error);
    throw new Error('Failed to reset settings');
  }
}

// ============================================
// EMAIL TEMPLATE FUNCTIONS
// ============================================

/**
 * Get all email templates
 */
export async function getEmailTemplates(filters?: {
  template_type?: string;
  meeting_type?: string;
  is_active?: boolean;
}): Promise<EmailTemplate[]> {
  const supabase = await createClient();

  let query = supabase
    .from('scheduler_email_templates')
    .select('*')
    .order('template_type')
    .order('name');

  if (filters?.template_type) {
    query = query.eq('template_type', filters.template_type);
  }
  if (filters?.meeting_type) {
    query = query.eq('meeting_type', filters.meeting_type);
  }
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Templates] Error fetching templates:', error);
    throw new Error('Failed to fetch email templates');
  }

  return data || [];
}

/**
 * Get a single email template
 */
export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_email_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error('Failed to fetch email template');
  }

  return data;
}

/**
 * Get template by slug
 */
export async function getEmailTemplateBySlug(slug: string): Promise<EmailTemplate | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_email_templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error('Failed to fetch email template');
  }

  return data;
}

/**
 * Create email template
 */
export async function createEmailTemplate(template: {
  name: string;
  slug: string;
  description?: string;
  template_type: string;
  meeting_type?: string;
  subject_template: string;
  body_template: string;
  available_variables?: string[];
  tone?: string;
  is_variant?: boolean;
  parent_template_id?: string;
  variant_name?: string;
  variant_weight?: number;
  created_by?: string;
}): Promise<EmailTemplate> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_email_templates')
    .insert(template)
    .select()
    .single();

  if (error) {
    console.error('[Templates] Error creating template:', error);
    throw new Error('Failed to create email template');
  }

  return data;
}

/**
 * Update email template
 */
export async function updateEmailTemplate(
  id: string,
  updates: Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>>
): Promise<EmailTemplate> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_email_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Templates] Error updating template:', error);
    throw new Error('Failed to update email template');
  }

  return data;
}

/**
 * Delete email template
 */
export async function deleteEmailTemplate(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduler_email_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Templates] Error deleting template:', error);
    throw new Error('Failed to delete email template');
  }
}

// ============================================
// SEASONALITY FUNCTIONS
// ============================================

/**
 * Get seasonality overrides
 */
export async function getSeasonalityOverrides(filters?: {
  is_active?: boolean;
  from_date?: string;
  to_date?: string;
}): Promise<SeasonalityOverride[]> {
  const supabase = await createClient();

  let query = supabase
    .from('scheduler_seasonality_overrides')
    .select('*')
    .order('start_date');

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }
  if (filters?.from_date) {
    query = query.gte('end_date', filters.from_date);
  }
  if (filters?.to_date) {
    query = query.lte('start_date', filters.to_date);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Seasonality] Error fetching overrides:', error);
    throw new Error('Failed to fetch seasonality overrides');
  }

  return data || [];
}

/**
 * Get active seasonality for a specific date
 */
export async function getActiveSeasonality(date?: string): Promise<SeasonalityOverride[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_active_seasonality', {
    p_date: date || new Date().toISOString().split('T')[0],
  });

  if (error) {
    console.error('[Seasonality] Error fetching active seasonality:', error);
    return [];
  }

  return data || [];
}

/**
 * Create seasonality override
 */
export async function createSeasonalityOverride(override: {
  start_date: string;
  end_date: string;
  override_type: string;
  name: string;
  description?: string;
  adjustments?: SeasonalityOverride['adjustments'];
  applies_to_industries?: string[];
  created_by?: string;
}): Promise<SeasonalityOverride> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_seasonality_overrides')
    .insert(override)
    .select()
    .single();

  if (error) {
    console.error('[Seasonality] Error creating override:', error);
    throw new Error('Failed to create seasonality override');
  }

  return data;
}

/**
 * Update seasonality override
 */
export async function updateSeasonalityOverride(
  id: string,
  updates: Partial<Omit<SeasonalityOverride, 'id' | 'created_at' | 'updated_at'>>
): Promise<SeasonalityOverride> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_seasonality_overrides')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Seasonality] Error updating override:', error);
    throw new Error('Failed to update seasonality override');
  }

  return data;
}

/**
 * Delete seasonality override
 */
export async function deleteSeasonalityOverride(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduler_seasonality_overrides')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Seasonality] Error deleting override:', error);
    throw new Error('Failed to delete seasonality override');
  }
}

// ============================================
// SOCIAL PROOF FUNCTIONS
// ============================================

/**
 * Get social proof entries
 */
export async function getSocialProofLibrary(filters?: {
  proof_type?: string;
  is_active?: boolean;
  target_industry?: string;
}): Promise<SocialProofEntry[]> {
  const supabase = await createClient();

  let query = supabase
    .from('scheduler_social_proof_library')
    .select('*')
    .order('times_used', { ascending: false });

  if (filters?.proof_type) {
    query = query.eq('proof_type', filters.proof_type);
  }
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }
  if (filters?.target_industry) {
    query = query.contains('target_industries', [filters.target_industry]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[SocialProof] Error fetching library:', error);
    throw new Error('Failed to fetch social proof library');
  }

  return data || [];
}

/**
 * Create social proof entry
 */
export async function createSocialProofEntry(entry: {
  proof_type: string;
  title: string;
  content: string;
  short_version?: string;
  source_company?: string;
  source_person?: string;
  source_title?: string;
  target_industries?: string[];
  target_company_sizes?: string[];
  target_personas?: string[];
  metric_value?: string;
  metric_label?: string;
  logo_url?: string;
  image_url?: string;
  created_by?: string;
}): Promise<SocialProofEntry> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_social_proof_library')
    .insert(entry)
    .select()
    .single();

  if (error) {
    console.error('[SocialProof] Error creating entry:', error);
    throw new Error('Failed to create social proof entry');
  }

  return data;
}

/**
 * Update social proof entry
 */
export async function updateSocialProofEntry(
  id: string,
  updates: Partial<Omit<SocialProofEntry, 'id' | 'created_at' | 'updated_at'>>
): Promise<SocialProofEntry> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_social_proof_library')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[SocialProof] Error updating entry:', error);
    throw new Error('Failed to update social proof entry');
  }

  return data;
}

/**
 * Delete social proof entry
 */
export async function deleteSocialProofEntry(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduler_social_proof_library')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[SocialProof] Error deleting entry:', error);
    throw new Error('Failed to delete social proof entry');
  }
}

/**
 * Record social proof usage
 */
export async function recordSocialProofUsageFromLibrary(
  id: string,
  converted: boolean = false
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    times_used: supabase.rpc('increment', { row_id: id, table_name: 'scheduler_social_proof_library', column_name: 'times_used' }),
  };

  if (converted) {
    updates.conversion_count = supabase.rpc('increment', { row_id: id, table_name: 'scheduler_social_proof_library', column_name: 'conversion_count' });
  }

  // Simple increment
  await supabase.rpc('increment_social_proof_usage', {
    p_id: id,
    p_converted: converted,
  });
}
