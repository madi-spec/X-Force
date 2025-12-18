/**
 * Social Proof Selection & Injection
 *
 * Selects relevant social proof content based on company profile
 * and injects it into follow-up communications.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// Types
export interface SocialProofItem {
  id: string;
  type: 'case_study' | 'stat' | 'testimonial' | 'resource' | 'industry_insight';
  title: string | null;
  content: string;
  source: string | null;
  link: string | null;
  relevant_for: SocialProofRelevance;
  times_used: number;
  conversion_rate: number | null;
}

export interface SocialProofRelevance {
  ownership_types?: string[];
  company_size?: { min?: number; max?: number };
  pain_points?: string[];
  products?: string[];
  industries?: string[];
  seasons?: string[];
}

export interface CompanyProfile {
  ownership_type?: string;
  employee_count?: number;
  pain_points?: string[];
  products_interested?: string[];
  industry?: string;
}

export interface SocialProofSelection {
  primary: SocialProofItem | null;
  secondary: SocialProofItem | null;
  reasoning: string;
}

/**
 * Get relevant social proof for a company profile
 */
export async function getSocialProofForCompany(
  companyId: string,
  options?: {
    type?: SocialProofItem['type'];
    excludeIds?: string[];
    limit?: number;
  }
): Promise<SocialProofItem[]> {
  const supabase = createAdminClient();

  // Get company profile
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (!company) {
    return [];
  }

  // Build company profile from available data
  const profile: CompanyProfile = {
    ownership_type: company.ownership_type,
    employee_count: company.employee_count,
    industry: company.industry,
  };

  // Get company pain points from deal context
  const { data: deals } = await supabase
    .from('deals')
    .select('pain_points, products_interested')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (deals?.[0]) {
    profile.pain_points = deals[0].pain_points;
    profile.products_interested = deals[0].products_interested;
  }

  return selectSocialProof(profile, options);
}

/**
 * Select social proof based on company profile
 */
export async function selectSocialProof(
  profile: CompanyProfile,
  options?: {
    type?: SocialProofItem['type'];
    excludeIds?: string[];
    limit?: number;
  }
): Promise<SocialProofItem[]> {
  const supabase = createAdminClient();
  const limit = options?.limit || 5;

  // Fetch all active social proof
  let query = supabase
    .from('social_proof_library')
    .select('*')
    .eq('is_active', true);

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  if (options?.excludeIds?.length) {
    query = query.not('id', 'in', `(${options.excludeIds.join(',')})`);
  }

  const { data: allProof, error } = await query;

  if (error || !allProof) {
    console.error('[SocialProof] Error fetching:', error);
    return [];
  }

  // Score each item based on relevance to profile
  const scored = allProof.map(item => ({
    item: item as SocialProofItem,
    score: calculateRelevanceScore(item.relevant_for as SocialProofRelevance, profile),
  }));

  // Sort by score (descending) and take top items
  scored.sort((a, b) => b.score - a.score);

  // Filter out items with 0 score unless we have no matches
  const relevant = scored.filter(s => s.score > 0);
  const results = relevant.length > 0 ? relevant : scored;

  return results.slice(0, limit).map(s => s.item);
}

/**
 * Calculate relevance score between social proof and company profile
 */
function calculateRelevanceScore(
  relevance: SocialProofRelevance,
  profile: CompanyProfile
): number {
  let score = 0;

  // Ownership type match (high weight)
  if (relevance.ownership_types && profile.ownership_type) {
    if (relevance.ownership_types.includes(profile.ownership_type)) {
      score += 30;
    }
  }

  // Company size match
  if (relevance.company_size && profile.employee_count) {
    const { min, max } = relevance.company_size;
    if (
      (!min || profile.employee_count >= min) &&
      (!max || profile.employee_count <= max)
    ) {
      score += 25;
    }
  }

  // Pain points match (can match multiple)
  if (relevance.pain_points && profile.pain_points) {
    const matches = relevance.pain_points.filter(p =>
      profile.pain_points?.includes(p)
    ).length;
    score += matches * 15;
  }

  // Products match
  if (relevance.products && profile.products_interested) {
    const matches = relevance.products.filter(p =>
      profile.products_interested?.includes(p)
    ).length;
    score += matches * 20;
  }

  // Industry match
  if (relevance.industries && profile.industry) {
    if (relevance.industries.includes(profile.industry)) {
      score += 20;
    }
  }

  // Season match
  if (relevance.seasons) {
    const currentSeason = getCurrentSeason();
    if (relevance.seasons.includes(currentSeason)) {
      score += 10;
    }
  }

  return score;
}

/**
 * Get current season for seasonal matching
 */
function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Select social proof for a scheduling attempt
 * Returns primary and secondary options with reasoning
 */
export async function selectSocialProofForScheduling(
  schedulingRequestId: string,
  attemptNumber: number
): Promise<SocialProofSelection> {
  const supabase = createAdminClient();

  // Get scheduling request with company info
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select(`
      id,
      company_id,
      deal_id,
      meeting_type
    `)
    .eq('id', schedulingRequestId)
    .single();

  if (!request?.company_id) {
    return {
      primary: null,
      secondary: null,
      reasoning: 'No company associated with scheduling request',
    };
  }

  // Get previously used social proof for this request
  const { data: previousUsage } = await supabase
    .from('scheduling_social_proof_usage')
    .select('social_proof_id')
    .eq('scheduling_request_id', schedulingRequestId);

  const excludeIds = previousUsage?.map(u => u.social_proof_id).filter(Boolean) || [];

  // Determine what type of proof to use based on attempt number
  let preferredType: SocialProofItem['type'] | undefined;
  if (attemptNumber <= 2) {
    preferredType = 'stat'; // Stats work well early
  } else if (attemptNumber <= 4) {
    preferredType = 'case_study'; // Case studies for mid-stage
  } else {
    preferredType = 'testimonial'; // Testimonials for late-stage
  }

  // Get social proof
  const proof = await getSocialProofForCompany(request.company_id, {
    type: preferredType,
    excludeIds,
    limit: 2,
  });

  // If no proof of preferred type, get any type
  let results = proof;
  if (results.length === 0) {
    results = await getSocialProofForCompany(request.company_id, {
      excludeIds,
      limit: 2,
    });
  }

  const reasoning = generateSelectionReasoning(results, attemptNumber, preferredType);

  return {
    primary: results[0] || null,
    secondary: results[1] || null,
    reasoning,
  };
}

/**
 * Generate reasoning for social proof selection
 */
function generateSelectionReasoning(
  selected: SocialProofItem[],
  attemptNumber: number,
  preferredType?: string
): string {
  if (selected.length === 0) {
    return 'No matching social proof found for company profile';
  }

  const reasons: string[] = [];

  if (preferredType) {
    reasons.push(`Attempt ${attemptNumber}: Preferred ${preferredType} content`);
  }

  if (selected[0]) {
    reasons.push(`Selected "${selected[0].title || selected[0].type}" as primary`);
    if (selected[0].conversion_rate) {
      reasons.push(`Historical conversion rate: ${(selected[0].conversion_rate * 100).toFixed(1)}%`);
    }
  }

  return reasons.join('. ');
}

/**
 * Record social proof usage for tracking
 */
export async function recordSocialProofUsage(
  schedulingRequestId: string,
  socialProofId: string,
  attemptNumber: number
): Promise<void> {
  const supabase = createAdminClient();

  // Insert usage record
  await supabase.from('scheduling_social_proof_usage').insert({
    scheduling_request_id: schedulingRequestId,
    social_proof_id: socialProofId,
    attempt_number: attemptNumber,
  });

  // Increment times_used on social proof
  await supabase.rpc('increment_social_proof_usage', {
    proof_id: socialProofId,
  });
}

/**
 * Update social proof outcome
 */
export async function updateSocialProofOutcome(
  schedulingRequestId: string,
  outcome: {
    led_to_response?: boolean;
    led_to_scheduling?: boolean;
  }
): Promise<void> {
  const supabase = createAdminClient();

  // Get usage records for this request
  const { data: usageRecords } = await supabase
    .from('scheduling_social_proof_usage')
    .select('id, social_proof_id')
    .eq('scheduling_request_id', schedulingRequestId)
    .is('led_to_response', null); // Only update unresolved records

  if (!usageRecords?.length) return;

  // Update each usage record
  for (const record of usageRecords) {
    await supabase
      .from('scheduling_social_proof_usage')
      .update({
        led_to_response: outcome.led_to_response,
        led_to_scheduling: outcome.led_to_scheduling,
      })
      .eq('id', record.id);

    // Update aggregated stats on social proof library
    if (outcome.led_to_response) {
      await supabase.rpc('increment_social_proof_response', {
        proof_id: record.social_proof_id,
      });
    }
    if (outcome.led_to_scheduling) {
      await supabase.rpc('increment_social_proof_scheduling', {
        proof_id: record.social_proof_id,
      });
    }
  }
}

/**
 * Format social proof for inclusion in email
 */
export function formatSocialProofForEmail(proof: SocialProofItem): string {
  const parts: string[] = [];

  switch (proof.type) {
    case 'stat':
      parts.push(`📊 ${proof.content}`);
      break;
    case 'case_study':
      parts.push(`📈 ${proof.title || 'Case Study'}`);
      parts.push(proof.content);
      break;
    case 'testimonial':
      parts.push(`💬 ${proof.content}`);
      break;
    case 'industry_insight':
      parts.push(`🎯 ${proof.title || 'Industry Insight'}`);
      parts.push(proof.content);
      break;
    default:
      parts.push(proof.content);
  }

  if (proof.source) {
    parts.push(`— ${proof.source}`);
  }

  return parts.join('\n');
}

/**
 * Get social proof performance report
 */
export async function getSocialProofPerformance(): Promise<{
  topPerformers: Array<SocialProofItem & { conversion_rate: number }>;
  lowPerformers: Array<SocialProofItem & { conversion_rate: number }>;
  byType: Record<string, { count: number; avgConversion: number }>;
}> {
  const supabase = createAdminClient();

  const { data: proof } = await supabase
    .from('social_proof_library')
    .select('*')
    .eq('is_active', true)
    .gt('times_used', 5); // Only items with meaningful sample

  if (!proof?.length) {
    return { topPerformers: [], lowPerformers: [], byType: {} };
  }

  // Calculate conversion rates
  const withRates = proof.map(p => ({
    ...p,
    conversion_rate: p.times_used > 0 ? (p.response_count || 0) / p.times_used : 0,
  }));

  // Sort by conversion rate
  withRates.sort((a, b) => b.conversion_rate - a.conversion_rate);

  // Group by type
  const byType: Record<string, { count: number; avgConversion: number }> = {};
  for (const item of withRates) {
    if (!byType[item.type]) {
      byType[item.type] = { count: 0, avgConversion: 0 };
    }
    byType[item.type].count++;
    byType[item.type].avgConversion += item.conversion_rate;
  }

  // Calculate averages
  for (const type in byType) {
    byType[type].avgConversion = byType[type].avgConversion / byType[type].count;
  }

  return {
    topPerformers: withRates.slice(0, 5) as Array<SocialProofItem & { conversion_rate: number }>,
    lowPerformers: withRates.slice(-5).reverse() as Array<SocialProofItem & { conversion_rate: number }>,
    byType,
  };
}
