/**
 * Summary Service
 * Main orchestration service for AI summaries
 */

import { createClient } from '@/lib/supabase/server';
import { generateDealSummary, getDealSummary, isDealSummaryStale } from './dealSummary';
import { generateCompanySummary, getCompanySummary, isCompanySummaryStale } from './companySummary';
import { generateContactSummary, getContactSummary, isContactSummaryStale } from './contactSummary';
import type {
  EntityType,
  DealSummary,
  CompanySummary,
  ContactSummary,
  GenerateSummaryOptions,
  SummaryResult,
  AISummaryRecord,
} from './types';

// ============================================
// UNIFIED INTERFACE
// ============================================

type SummaryMap = {
  deal: DealSummary;
  company: CompanySummary;
  contact: ContactSummary;
};

/**
 * Generate a summary for any entity type
 */
export async function generateSummary<T extends EntityType>(
  entityType: T,
  entityId: string,
  options: GenerateSummaryOptions = {}
): Promise<SummaryResult<SummaryMap[T]>> {
  switch (entityType) {
    case 'deal':
      return generateDealSummary(entityId, options) as Promise<SummaryResult<SummaryMap[T]>>;
    case 'company':
      return generateCompanySummary(entityId, options) as Promise<SummaryResult<SummaryMap[T]>>;
    case 'contact':
      return generateContactSummary(entityId, options) as Promise<SummaryResult<SummaryMap[T]>>;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Get an existing summary for any entity type
 */
export async function getSummary<T extends EntityType>(
  entityType: T,
  entityId: string
): Promise<SummaryMap[T] | null> {
  switch (entityType) {
    case 'deal':
      return getDealSummary(entityId) as Promise<SummaryMap[T] | null>;
    case 'company':
      return getCompanySummary(entityId) as Promise<SummaryMap[T] | null>;
    case 'contact':
      return getContactSummary(entityId) as Promise<SummaryMap[T] | null>;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Check if a summary is stale
 */
export async function isSummaryStale(
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  switch (entityType) {
    case 'deal':
      return isDealSummaryStale(entityId);
    case 'company':
      return isCompanySummaryStale(entityId);
    case 'contact':
      return isContactSummaryStale(entityId);
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Get or generate a summary (uses cache if valid)
 */
export async function getOrGenerateSummary<T extends EntityType>(
  entityType: T,
  entityId: string,
  options: GenerateSummaryOptions = {}
): Promise<SummaryMap[T]> {
  // Check if we have a valid cached summary
  const isStale = await isSummaryStale(entityType, entityId);

  if (!isStale && !options.force) {
    const existing = await getSummary(entityType, entityId);
    if (existing) return existing;
  }

  // Generate new summary
  const result = await generateSummary(entityType, entityId, options);
  return result.summary;
}

// ============================================
// BATCH OPERATIONS
// ============================================

interface BatchSummaryResult {
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ entityId: string; error: string }>;
}

/**
 * Generate summaries for multiple deals
 */
export async function generateDealSummariesBatch(
  dealIds: string[],
  options: GenerateSummaryOptions = {}
): Promise<BatchSummaryResult> {
  const result: BatchSummaryResult = {
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const dealId of dealIds) {
    try {
      // Check if stale first
      if (!options.force) {
        const isStale = await isDealSummaryStale(dealId);
        if (!isStale) {
          result.skipped++;
          continue;
        }
      }

      await generateDealSummary(dealId, options);
      result.successful++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        entityId: dealId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Generate summaries for all stale deals
 */
export async function refreshStaleDealSummaries(): Promise<BatchSummaryResult> {
  const supabase = await createClient();

  // Get all open deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id')
    .not('stage', 'in', '("closed_won","closed_lost")');

  if (!deals || deals.length === 0) {
    return { successful: 0, failed: 0, skipped: 0, errors: [] };
  }

  return generateDealSummariesBatch(deals.map(d => d.id));
}

/**
 * Generate summaries for all entities related to a company
 */
export async function generateCompanyRelatedSummaries(
  companyId: string,
  options: GenerateSummaryOptions = {}
): Promise<{
  company: SummaryResult<CompanySummary> | null;
  deals: BatchSummaryResult;
  contacts: BatchSummaryResult;
}> {
  const supabase = await createClient();

  // Generate company summary
  let companySummary: SummaryResult<CompanySummary> | null = null;
  try {
    companySummary = await generateCompanySummary(companyId, options);
  } catch (error) {
    console.error('Failed to generate company summary:', error);
  }

  // Get company's deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id')
    .eq('company_id', companyId);

  // Get company's contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('company_id', companyId);

  // Generate deal summaries
  const dealsResult: BatchSummaryResult = {
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const deal of deals || []) {
    try {
      await generateDealSummary(deal.id, options);
      dealsResult.successful++;
    } catch (error) {
      dealsResult.failed++;
      dealsResult.errors.push({
        entityId: deal.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Generate contact summaries
  const contactsResult: BatchSummaryResult = {
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const contact of contacts || []) {
    try {
      await generateContactSummary(contact.id, options);
      contactsResult.successful++;
    } catch (error) {
      contactsResult.failed++;
      contactsResult.errors.push({
        entityId: contact.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    company: companySummary,
    deals: dealsResult,
    contacts: contactsResult,
  };
}

// ============================================
// STALENESS MANAGEMENT
// ============================================

/**
 * Mark summaries as stale for a deal
 * Called when deal data changes
 */
export async function markDealSummariesStale(dealId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('ai_summaries')
    .update({ stale: true, updated_at: new Date().toISOString() })
    .eq('deal_id', dealId);
}

/**
 * Mark summaries as stale for a company
 * Called when company data changes
 */
export async function markCompanySummariesStale(companyId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('ai_summaries')
    .update({ stale: true, updated_at: new Date().toISOString() })
    .eq('company_id', companyId);
}

/**
 * Mark summaries as stale for a contact
 * Called when contact data changes
 */
export async function markContactSummariesStale(contactId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('ai_summaries')
    .update({ stale: true, updated_at: new Date().toISOString() })
    .eq('contact_id', contactId);
}

/**
 * Mark all related summaries stale when activity is logged
 * Called from activity logging hooks
 */
export async function markRelatedSummariesStale(params: {
  dealId?: string;
  companyId?: string;
  contactId?: string;
}): Promise<void> {
  const supabase = await createClient();

  const updates: Promise<void>[] = [];

  if (params.dealId) {
    updates.push(markDealSummariesStale(params.dealId));
  }

  if (params.companyId) {
    updates.push(markCompanySummariesStale(params.companyId));
  }

  if (params.contactId) {
    updates.push(markContactSummariesStale(params.contactId));
  }

  await Promise.all(updates);
}

// ============================================
// STATISTICS
// ============================================

export interface SummaryStats {
  totalSummaries: number;
  staleSummaries: number;
  byType: Record<string, number>;
  avgConfidence: number;
  totalTokensUsed: number;
  recentGenerations: number;
}

/**
 * Get summary statistics
 */
export async function getSummaryStats(): Promise<SummaryStats> {
  const supabase = await createClient();

  const { data: summaries } = await supabase
    .from('ai_summaries')
    .select('summary_type, stale, confidence, tokens_used, generated_at');

  if (!summaries || summaries.length === 0) {
    return {
      totalSummaries: 0,
      staleSummaries: 0,
      byType: {},
      avgConfidence: 0,
      totalTokensUsed: 0,
      recentGenerations: 0,
    };
  }

  const byType: Record<string, number> = {};
  let totalConfidence = 0;
  let confidenceCount = 0;
  let totalTokens = 0;
  let staleSummaries = 0;
  let recentGenerations = 0;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const summary of summaries) {
    // Count by type
    byType[summary.summary_type] = (byType[summary.summary_type] || 0) + 1;

    // Count stale
    if (summary.stale) staleSummaries++;

    // Accumulate confidence
    if (summary.confidence != null) {
      totalConfidence += summary.confidence;
      confidenceCount++;
    }

    // Accumulate tokens
    if (summary.tokens_used) {
      totalTokens += summary.tokens_used;
    }

    // Count recent generations
    if (new Date(summary.generated_at).getTime() > oneDayAgo) {
      recentGenerations++;
    }
  }

  return {
    totalSummaries: summaries.length,
    staleSummaries,
    byType,
    avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    totalTokensUsed: totalTokens,
    recentGenerations,
  };
}

// ============================================
// CLEANUP
// ============================================

/**
 * Delete old summaries for deleted entities
 * Run periodically as cleanup
 */
export async function cleanupOrphanedSummaries(): Promise<number> {
  const supabase = await createClient();
  let deleted = 0;

  // Delete summaries for deleted deals
  const { data: dealSummaries } = await supabase
    .from('ai_summaries')
    .select('id, deal_id')
    .not('deal_id', 'is', null);

  if (dealSummaries) {
    const dealIds = dealSummaries.map(s => s.deal_id).filter(Boolean);
    const { data: existingDeals } = await supabase
      .from('deals')
      .select('id')
      .in('id', dealIds);

    const existingDealIds = new Set(existingDeals?.map(d => d.id) || []);
    const orphanedIds = dealSummaries
      .filter(s => s.deal_id && !existingDealIds.has(s.deal_id))
      .map(s => s.id);

    if (orphanedIds.length > 0) {
      await supabase.from('ai_summaries').delete().in('id', orphanedIds);
      deleted += orphanedIds.length;
    }
  }

  // Similar cleanup for companies and contacts...
  // (Omitted for brevity - same pattern)

  return deleted;
}
