import { createAdminClient } from '@/lib/supabase/admin';
import type { Collateral, MeetingType, ProductTag, IndustryTag, CompanySizeTag } from '@/types/collateral';

export interface MatchingContext {
  meetingType: MeetingType;
  products: ProductTag[];
  industry?: IndustryTag;
  companySize?: CompanySizeTag;
}

export interface ScoredCollateral extends Collateral {
  relevanceScore: number;
}

/**
 * Get collateral matching the meeting context, ranked by relevance
 */
export async function getMatchingCollateral(
  context: MatchingContext
): Promise<ScoredCollateral[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('collateral')
    .select('*')
    .eq('is_current', true)
    .is('archived_at', null);

  if (!data || data.length === 0) return [];

  // Score each item by relevance
  const scored = data.map((item: Collateral) => {
    let score = 0;

    // Meeting type match (+10)
    if (item.meeting_types?.includes(context.meetingType)) {
      score += 10;
    }

    // Product match (+5 each)
    const productMatches = context.products.filter(p =>
      item.products?.includes(p) || item.products?.includes('platform')
    ).length;
    score += productMatches * 5;

    // Industry match (+3)
    if (context.industry &&
        (item.industries?.includes(context.industry) ||
         item.industries?.includes('general'))) {
      score += 3;
    }

    // Company size match (+2)
    if (context.companySize &&
        (item.company_sizes?.includes(context.companySize) ||
         item.company_sizes?.length === 0)) {
      score += 2;
    }

    // Boost frequently used items slightly
    if (item.view_count > 10) score += 1;

    return {
      ...item,
      relevanceScore: score,
    } as ScoredCollateral;
  });

  // Return items with score > 0, sorted by relevance
  return scored
    .filter(item => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);
}

/**
 * Get all collateral for a specific document type
 */
export async function getCollateralByDocumentType(
  documentType: string
): Promise<Collateral[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('collateral')
    .select('*')
    .eq('document_type', documentType)
    .eq('is_current', true)
    .is('archived_at', null)
    .order('name');

  return (data || []) as Collateral[];
}

/**
 * Get recently used collateral for a user
 */
export async function getRecentlyUsedCollateral(
  userId: string,
  limit: number = 5
): Promise<Collateral[]> {
  const supabase = createAdminClient();

  // Get recent usage
  const { data: usage } = await supabase
    .from('collateral_usage')
    .select('collateral_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Get extra in case of duplicates

  if (!usage || usage.length === 0) return [];

  // Get unique collateral IDs
  const uniqueIds = [...new Set(usage.map(u => u.collateral_id))].slice(0, limit);

  // Fetch the collateral items
  const { data } = await supabase
    .from('collateral')
    .select('*')
    .in('id', uniqueIds)
    .eq('is_current', true)
    .is('archived_at', null);

  return (data || []) as Collateral[];
}

/**
 * Track collateral usage
 */
export async function trackCollateralUsage(
  collateralId: string,
  userId: string,
  action: 'viewed' | 'downloaded' | 'shared' | 'copied_link',
  context?: {
    meetingId?: string;
    dealId?: string;
    companyId?: string;
  }
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('collateral_usage').insert({
    collateral_id: collateralId,
    user_id: userId,
    action,
    meeting_id: context?.meetingId || null,
    deal_id: context?.dealId || null,
    company_id: context?.companyId || null,
  });

  // Update collateral counters
  if (action === 'viewed') {
    await supabase.rpc('increment_collateral_view_count', { collateral_id: collateralId });
  } else if (action === 'shared') {
    await supabase.rpc('increment_collateral_share_count', { collateral_id: collateralId });
  }

  // Update last_used_at
  await supabase
    .from('collateral')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', collateralId);
}
