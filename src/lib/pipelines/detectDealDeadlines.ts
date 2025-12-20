/**
 * Pipeline 3: Deal Deadline Proximity (Tier 2)
 *
 * Scans deals for Tier 2 triggers:
 * - Close date within 14 days
 * - Stale deals (10+ days no activity)
 * - High value deals needing attention
 *
 * Creates command center items for deals requiring urgent action.
 */

import { createClient } from '@/lib/supabase/server';
import type { PriorityTier, TierTrigger } from '@/types/commandCenter';

interface Deal {
  id: string;
  owner_id: string;
  name: string;
  stage: string;
  estimated_value: number;
  expected_close_date: string | null;
  last_activity_at: string | null;
  days_since_activity: number | null;
  value_percentile: number | null;
  competitors: string[] | null;
  company_id: string | null;
  company: { name: string } | null;
}

interface PipelineResult {
  dealsProcessed: number;
  itemsCreated: number;
  byTrigger: Record<string, number>;
  errors: string[];
}

/**
 * Calculate urgency score based on days until close
 */
function calculateDeadlineUrgency(daysUntilClose: number): number {
  if (daysUntilClose <= 3) return 100;
  if (daysUntilClose <= 7) return 85;
  if (daysUntilClose <= 14) return 70;
  return 50;
}

/**
 * Calculate urgency for stale deals
 */
function calculateStaleUrgency(daysSinceActivity: number, dealValue: number): number {
  let score = 50;

  // More stale = more urgent
  if (daysSinceActivity >= 21) score += 30;
  else if (daysSinceActivity >= 14) score += 20;
  else if (daysSinceActivity >= 10) score += 10;

  // Higher value = more urgent
  if (dealValue >= 100000) score += 20;
  else if (dealValue >= 50000) score += 15;
  else if (dealValue >= 25000) score += 10;

  return Math.min(score, 100);
}

/**
 * Generate "why now" text for deadline items
 */
function generateDeadlineWhyNow(deal: Deal, daysUntilClose: number): string {
  const value = deal.estimated_value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  if (daysUntilClose <= 0) {
    return `${value} deal was expected to close today. Follow up immediately.`;
  }
  if (daysUntilClose === 1) {
    return `${value} deal closes tomorrow. Confirm status.`;
  }
  if (daysUntilClose <= 3) {
    return `${value} deal closes in ${daysUntilClose} days. Push to close.`;
  }
  if (daysUntilClose <= 7) {
    return `${value} deal closes this week. Ensure no blockers.`;
  }
  return `${value} deal closes in ${daysUntilClose} days. Review pipeline.`;
}

/**
 * Generate "why now" text for stale deals
 */
function generateStaleWhyNow(deal: Deal): string {
  const value = deal.estimated_value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const days = deal.days_since_activity || 0;

  if (days >= 21) {
    return `${value} deal silent for ${days} days. Re-engage or qualify out.`;
  }
  if (days >= 14) {
    return `${value} deal going cold - ${days} days since activity.`;
  }
  return `${value} deal needs attention - ${days} days since last touch.`;
}

/**
 * Generate "why now" for competitive deals
 */
function generateCompetitiveWhyNow(deal: Deal): string {
  const competitors = deal.competitors || [];
  const value = deal.estimated_value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return `${value} deal evaluating ${competitors.join(', ')}. Strengthen position.`;
}

/**
 * Check if a CC item already exists for this deal + trigger
 */
async function itemExists(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  dealId: string,
  trigger: string
): Promise<boolean> {
  const { data } = await supabase
    .from('command_center_items')
    .select('id')
    .eq('deal_id', dealId)
    .eq('tier', 2)
    .eq('tier_trigger', trigger)
    .eq('status', 'pending')
    .single();

  return !!data;
}

/**
 * Main pipeline function: Detect deal deadlines
 */
export async function detectDealDeadlines(userId?: string): Promise<PipelineResult> {
  const supabase = await createClient();
  const result: PipelineResult = {
    dealsProcessed: 0,
    itemsCreated: 0,
    byTrigger: {},
    errors: [],
  };

  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  // Query for deals with upcoming close dates or stale activity
  let query = supabase
    .from('deals')
    .select(`
      id,
      owner_id,
      name,
      stage,
      estimated_value,
      expected_close_date,
      last_activity_at,
      days_since_activity,
      value_percentile,
      competitors,
      company_id,
      company:companies(name)
    `)
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('expected_close_date', { ascending: true });

  if (userId) {
    query = query.eq('owner_id', userId);
  }

  const { data: deals, error } = await query;

  if (error) {
    result.errors.push(`Query error: ${error.message}`);
    return result;
  }

  if (!deals || deals.length === 0) {
    return result;
  }

  for (const rawDeal of deals) {
    // Handle company join which may be array or single object
    const companyData = rawDeal.company;
    const company = Array.isArray(companyData)
      ? (companyData[0] as { name: string } | undefined)
      : (companyData as { name: string } | null);

    const deal: Deal = {
      ...rawDeal,
      company: company ?? null,
    };

    try {
      result.dealsProcessed++;
      const nowTimestamp = new Date().toISOString();

      // Check 1: Close date within 14 days
      if (deal.expected_close_date) {
        const closeDate = new Date(deal.expected_close_date);
        const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilClose <= 14) {
          const exists = await itemExists(supabase, deal.id, 'deadline_critical');

          if (!exists) {
            await supabase.from('command_center_items').insert({
              user_id: deal.owner_id,
              deal_id: deal.id,
              company_id: deal.company_id,
              action_type: 'call',
              title: `Close deal: ${deal.name}`,
              description: `Expected close date: ${deal.expected_close_date}`,
              why_now: generateDeadlineWhyNow(deal, daysUntilClose),
              tier: 2 as PriorityTier,
              tier_trigger: 'deadline_critical',
              urgency_score: calculateDeadlineUrgency(daysUntilClose),
              due_at: deal.expected_close_date,
              deal_value: deal.estimated_value,
              deal_stage: deal.stage,
              company_name: company?.name || null,
              status: 'pending',
              source: 'system',
              created_at: nowTimestamp,
              updated_at: nowTimestamp,
            });

            result.itemsCreated++;
            result.byTrigger['deadline_critical'] = (result.byTrigger['deadline_critical'] || 0) + 1;
          }
        }
      }

      // Check 2: Stale deals (10+ days no activity)
      const daysSinceActivity = deal.days_since_activity || 0;
      if (daysSinceActivity >= 10) {
        const exists = await itemExists(supabase, deal.id, 'going_stale');

        if (!exists) {
          await supabase.from('command_center_items').insert({
            user_id: deal.owner_id,
            deal_id: deal.id,
            company_id: deal.company_id,
            action_type: 'call',
            title: `Re-engage: ${deal.name}`,
            description: `No activity for ${daysSinceActivity} days`,
            why_now: generateStaleWhyNow(deal),
            tier: 2 as PriorityTier,
            tier_trigger: 'going_stale',
            urgency_score: calculateStaleUrgency(daysSinceActivity, deal.estimated_value),
            deal_value: deal.estimated_value,
            deal_stage: deal.stage,
            company_name: company?.name || null,
            status: 'pending',
            source: 'system',
            created_at: nowTimestamp,
            updated_at: nowTimestamp,
          });

          result.itemsCreated++;
          result.byTrigger['going_stale'] = (result.byTrigger['going_stale'] || 0) + 1;
        }
      }

      // Check 3: Competitive deals
      if (deal.competitors && deal.competitors.length > 0) {
        const exists = await itemExists(supabase, deal.id, 'competitive_risk');

        if (!exists) {
          await supabase.from('command_center_items').insert({
            user_id: deal.owner_id,
            deal_id: deal.id,
            company_id: deal.company_id,
            action_type: 'research_account',
            title: `Competitive positioning: ${deal.name}`,
            description: `Competitors: ${deal.competitors.join(', ')}`,
            why_now: generateCompetitiveWhyNow(deal),
            tier: 2 as PriorityTier,
            tier_trigger: 'competitive_risk',
            urgency_score: 70,
            deal_value: deal.estimated_value,
            deal_stage: deal.stage,
            company_name: company?.name || null,
            status: 'pending',
            source: 'system',
            created_at: nowTimestamp,
            updated_at: nowTimestamp,
          });

          result.itemsCreated++;
          result.byTrigger['competitive_risk'] = (result.byTrigger['competitive_risk'] || 0) + 1;
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Deal ${deal.id}: ${errorMsg}`);
    }
  }

  return result;
}

export default detectDealDeadlines;
