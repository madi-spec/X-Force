/**
 * Process Context Detection
 *
 * Determines the appropriate process type for AI features based on:
 * 1. Explicit meeting/activity metadata override
 * 2. Company's current process type (from company_product_read_model)
 * 3. User's default process type
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type ProcessType = 'sales' | 'onboarding' | 'engagement' | 'support';

interface ProcessContextParams {
  userId: string;
  companyId?: string | null;
  meetingMetadata?: { process_type?: string } | null;
}

/**
 * Get the appropriate process type for a given context
 * Priority: metadata override > company process type > user default
 */
export async function getProcessTypeForContext(
  params: ProcessContextParams
): Promise<ProcessType> {
  const { userId, companyId, meetingMetadata } = params;

  // 1. Check meeting metadata override (highest priority)
  if (meetingMetadata?.process_type) {
    const override = meetingMetadata.process_type as ProcessType;
    if (isValidProcessType(override)) {
      console.log(`[ProcessContext] Using metadata override: ${override}`);
      return override;
    }
  }

  // 2. Check company's current process type
  if (companyId) {
    const companyProcessType = await getCompanyProcessType(companyId);
    if (companyProcessType) {
      console.log(`[ProcessContext] Using company process type: ${companyProcessType}`);
      return companyProcessType;
    }
  }

  // 3. Fall back to user default
  const userDefault = await getUserDefaultProcessType(userId);
  console.log(`[ProcessContext] Using user default: ${userDefault}`);
  return userDefault;
}

/**
 * Get company's current process type from projection
 */
async function getCompanyProcessType(companyId: string): Promise<ProcessType | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('company_product_read_model')
    .select('current_process_type')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.current_process_type && isValidProcessType(data.current_process_type)) {
    return data.current_process_type as ProcessType;
  }

  return null;
}

/**
 * Get user's default process type
 */
async function getUserDefaultProcessType(userId: string): Promise<ProcessType> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('users')
    .select('default_process_type')
    .eq('id', userId)
    .single();

  if (data?.default_process_type && isValidProcessType(data.default_process_type)) {
    return data.default_process_type as ProcessType;
  }

  // Ultimate fallback
  return 'sales';
}

/**
 * Validate process type string
 */
export function isValidProcessType(value: string): value is ProcessType {
  return ['sales', 'onboarding', 'engagement', 'support'].includes(value);
}

/**
 * Get display label for process type
 */
export function getProcessTypeLabel(type: ProcessType): string {
  const labels: Record<ProcessType, string> = {
    sales: 'Sales',
    onboarding: 'Onboarding',
    engagement: 'Customer Success',
    support: 'Support',
  };
  return labels[type];
}

/**
 * Get all process types with labels for UI dropdowns
 */
export function getProcessTypeOptions(): Array<{ value: ProcessType; label: string }> {
  return [
    { value: 'sales', label: 'Sales' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'engagement', label: 'Customer Success' },
    { value: 'support', label: 'Support' },
  ];
}
