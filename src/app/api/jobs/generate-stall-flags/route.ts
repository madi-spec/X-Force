/**
 * POST /api/jobs/generate-stall-flags
 *
 * Generates attention flags for stalled deals based on:
 * - STALE_IN_STAGE: No movement for too long
 * - NO_NEXT_STEP_AFTER_MEETING: Meeting happened but no next step
 * - GHOSTING_AFTER_PROPOSAL: No inbound communication after proposal
 *
 * Also auto-resolves flags when conditions no longer apply:
 * - STALE_IN_STAGE: resolved if stage age <= threshold
 * - NO_NEXT_STEP_AFTER_MEETING: resolved if next_step_due_at is in the future
 * - GHOSTING_AFTER_PROPOSAL: resolved if inbound communication within 2 days
 *
 * Dedupes by company_product_id + flag_type (updates existing if found).
 * Returns: { created, updated, resolved, processed }
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstOrNull } from '@/lib/supabase/normalize';
import { AttentionFlagType, AttentionFlagSeverity } from '@/types/operatingLayer';

// ============================================
// STALE THRESHOLDS BY STAGE (in days)
// ============================================

const STALE_THRESHOLDS: Record<string, number> = {
  discovery: 4,
  demo: 5,
  proposal: 3,
  negotiation: 2,
  negotiating: 2,
  // Default for unmatched stages
  default: 5,
};

// Days without inbound comms to trigger ghosting
const GHOSTING_THRESHOLD_DAYS = 5;

// Days of recent inbound communication to resolve ghosting flag
const GHOSTING_RESOLVE_THRESHOLD_DAYS = 2;

// Terminal stage patterns - stages that indicate deal is no longer active
const TERMINAL_STAGE_PATTERNS = ['won', 'lost', 'closed', 'canceled', 'cancelled'];

// ============================================
// HELPERS
// ============================================

function isTerminalStage(stageSlug: string | null, stageName: string | null): boolean {
  const slug = (stageSlug || '').toLowerCase();
  const name = (stageName || '').toLowerCase();

  for (const pattern of TERMINAL_STAGE_PATTERNS) {
    if (slug.includes(pattern) || name.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function getStaleThreshold(stageName: string | null): number {
  if (!stageName) return STALE_THRESHOLDS.default;
  const normalized = stageName.toLowerCase().trim();

  // Check for partial matches
  for (const [key, value] of Object.entries(STALE_THRESHOLDS)) {
    if (key !== 'default' && normalized.includes(key)) {
      return value;
    }
  }

  return STALE_THRESHOLDS.default;
}

function getStaleSeverity(daysStale: number, threshold: number): AttentionFlagSeverity {
  if (daysStale >= threshold * 2) return 'high';
  return 'medium';
}

function daysBetween(date1: Date, date2: Date): number {
  const diffMs = date2.getTime() - date1.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST() {
  // ============================================
  // 0. Validate service role key is present
  // ============================================
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[GenerateStallFlags] Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    return NextResponse.json(
      { success: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    );
  }

  try {
    // Use admin client (service role) to bypass RLS - required for background jobs
    const supabase = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();

    console.log('[GenerateStallFlags] Starting job execution at', nowIso);
    console.log('[GenerateStallFlags] Using admin client (service role) to bypass RLS');

    let created = 0;
    let updated = 0;
    let resolved = 0;

    // ============================================
    // 1. Get company_products in active sales pipeline
    // ============================================
    // Selection criteria:
    // - current_stage_id IS NOT NULL (has an active pipeline stage)
    // - Exclude terminal stages (won, lost, closed, canceled)
    // - Do NOT require status='in_sales' (DB uses 'active' status)

    console.log('[GenerateStallFlags] Querying company_products with current_stage_id IS NOT NULL');

    // First, get total count for debugging
    const { count: totalCount, error: countError } = await supabase
      .from('company_products')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[GenerateStallFlags] Error counting total company_products:', countError);
    }
    const totalCompanyProducts = totalCount ?? 0;
    console.log(`[GenerateStallFlags] Total company_products in DB: ${totalCompanyProducts}`);

    // Debug: Check status distribution
    const { data: statusSample } = await supabase
      .from('company_products')
      .select('status, current_stage_id')
      .limit(20);

    const statusDist: Record<string, number> = {};
    let withStageCount = 0;
    for (const row of statusSample || []) {
      statusDist[row.status] = (statusDist[row.status] || 0) + 1;
      if (row.current_stage_id) withStageCount++;
    }
    console.log('[GenerateStallFlags] Status distribution (sample of 20):', statusDist);
    console.log(`[GenerateStallFlags] Sample rows with current_stage_id: ${withStageCount}/20`);

    // Get company_products with current_stage_id (in pipeline)
    const { data: allWithStage, error: cpError } = await supabase
      .from('company_products')
      .select(`
        id,
        company_id,
        product_id,
        status,
        current_stage_id,
        created_at,
        updated_at,
        last_stage_moved_at,
        next_step_due_at,
        current_stage:product_process_stages(id, name, slug, stage_order)
      `)
      .not('current_stage_id', 'is', null);

    if (cpError) {
      console.error('[GenerateStallFlags] Error fetching company_products:', cpError);
      console.error('[GenerateStallFlags] Error details:', JSON.stringify(cpError, null, 2));
      throw cpError;
    }

    const withCurrentStageId = allWithStage?.length ?? 0;
    console.log(`[GenerateStallFlags] company_products with current_stage_id: ${withCurrentStageId}`);

    // NO FALLBACK: Only process company_products with current_stage_id IS NOT NULL
    // status='active' represents product adoption, NOT active sales pipeline
    if (!allWithStage || allWithStage.length === 0) {
      console.log('[GenerateStallFlags] No company products with current_stage_id found, exiting');
      console.log('[GenerateStallFlags] Note: status=active rows are product adoptions, not sales pipeline');
      return NextResponse.json({
        success: true,
        created: 0,
        updated: 0,
        resolved: 0,
        processed: 0,
        debug: {
          total_company_products: totalCompanyProducts,
          with_current_stage_id: 0,
          eligible_after_terminal_exclusion: 0,
        },
        message: 'No company products in active sales pipeline (current_stage_id is required)',
      });
    }

    // Filter out terminal stages (won, lost, closed, canceled)
    const companyProducts = allWithStage.filter((cp) => {
      const stage = firstOrNull(cp.current_stage as { id: string; name: string; slug: string; stage_order: number } | { id: string; name: string; slug: string; stage_order: number }[] | null);

      // Stage should exist since we filtered by current_stage_id IS NOT NULL
      if (!stage) return true;

      const stageSlug = stage.slug || null;
      const stageName = stage.name || null;

      if (isTerminalStage(stageSlug, stageName)) {
        return false; // Exclude terminal stages
      }
      return true;
    });

    const eligibleAfterTerminalExclusion = companyProducts.length;
    console.log(`[GenerateStallFlags] After excluding terminal stages: ${eligibleAfterTerminalExclusion} eligible`);
    console.log(`[GenerateStallFlags] Terminal stage patterns: ${TERMINAL_STAGE_PATTERNS.join(', ')}`);

    if (companyProducts.length === 0) {
      console.log('[GenerateStallFlags] All company products are in terminal stages, exiting early');
      return NextResponse.json({
        success: true,
        created: 0,
        updated: 0,
        resolved: 0,
        processed: 0,
        debug: {
          total_company_products: totalCompanyProducts,
          with_current_stage_id: withCurrentStageId,
          eligible_after_terminal_exclusion: 0,
        },
        message: 'All company products are in terminal stages (won/lost/closed)',
      });
    }

    console.log(`[GenerateStallFlags] Processing ${companyProducts.length} company products`);
    console.log('[GenerateStallFlags] Company IDs:', companyProducts.map(cp => cp.company_id).slice(0, 10).join(', ') + (companyProducts.length > 10 ? '...' : ''));

    // Debug: Log some stage info
    const stageCounts = new Map<string, number>();
    for (const cp of companyProducts) {
      const stage = firstOrNull(cp.current_stage as { id: string; name: string; slug: string; stage_order: number } | { id: string; name: string; slug: string; stage_order: number }[] | null);
      const stageName = stage?.name || 'unknown';
      stageCounts.set(stageName, (stageCounts.get(stageName) || 0) + 1);
    }
    console.log('[GenerateStallFlags] Stage distribution:', Object.fromEntries(stageCounts));

    // ============================================
    // 2. Get existing open attention flags for deduping
    // ============================================

    const companyProductIds = companyProducts.map((cp) => cp.id);
    console.log(`[GenerateStallFlags] Fetching existing pipeline flags for ${companyProductIds.length} company products`);

    const { data: existingFlags, error: flagsError } = await supabase
      .from('attention_flags')
      .select('id, company_product_id, flag_type, source_type')
      .eq('status', 'open')
      .eq('source_type', 'pipeline') // Only flags created by this generator (not manual flags)
      .in('company_product_id', companyProductIds)
      .in('flag_type', ['STALE_IN_STAGE', 'NO_NEXT_STEP_AFTER_MEETING', 'GHOSTING_AFTER_PROPOSAL']);

    if (flagsError) {
      console.error('[GenerateStallFlags] Error fetching existing flags:', flagsError);
    }

    console.log(`[GenerateStallFlags] Found ${existingFlags?.length ?? 0} existing pipeline flags (source_type='pipeline')`);

    // Build lookup map: company_product_id + flag_type -> flag_id
    const existingFlagMap = new Map<string, string>();
    for (const flag of existingFlags || []) {
      const key = `${flag.company_product_id}:${flag.flag_type}`;
      existingFlagMap.set(key, flag.id);
    }

    // Track which existing flags are still valid (will be updated or kept)
    const flagsStillValid = new Set<string>();

    // ============================================
    // 3. Get last meeting dates for NO_NEXT_STEP check
    // ============================================

    const companyIds = companyProducts.map((cp) => cp.company_id);
    console.log(`[GenerateStallFlags] Fetching meetings for ${companyIds.length} companies`);

    const { data: lastMeetings, error: meetingsError } = await supabase
      .from('communications')
      .select('company_id, occurred_at')
      .eq('channel', 'meeting')
      .in('company_id', companyIds)
      .order('occurred_at', { ascending: false });

    if (meetingsError) {
      console.error('[GenerateStallFlags] Error fetching meetings:', meetingsError);
    }

    // Build map of company_id -> last meeting date
    const lastMeetingMap = new Map<string, Date>();
    for (const meeting of lastMeetings || []) {
      if (!lastMeetingMap.has(meeting.company_id)) {
        lastMeetingMap.set(meeting.company_id, new Date(meeting.occurred_at));
      }
    }
    console.log(`[GenerateStallFlags] Found meetings for ${lastMeetingMap.size} companies`);

    // ============================================
    // 4. Get last inbound communication for GHOSTING check
    // ============================================

    console.log(`[GenerateStallFlags] Fetching inbound communications for ${companyIds.length} companies`);

    const { data: lastInbounds, error: inboundsError } = await supabase
      .from('communications')
      .select('company_id, occurred_at')
      .eq('direction', 'inbound')
      .in('company_id', companyIds)
      .order('occurred_at', { ascending: false });

    if (inboundsError) {
      console.error('[GenerateStallFlags] Error fetching inbound communications:', inboundsError);
    }

    // Build map of company_id -> last inbound date
    const lastInboundMap = new Map<string, Date>();
    for (const comm of lastInbounds || []) {
      if (!lastInboundMap.has(comm.company_id)) {
        lastInboundMap.set(comm.company_id, new Date(comm.occurred_at));
      }
    }
    console.log(`[GenerateStallFlags] Found inbound communications for ${lastInboundMap.size} companies`);

    // ============================================
    // 5. Process each company product
    // ============================================

    const flagsToInsert: Array<{
      company_id: string;
      company_product_id: string;
      source_type: 'pipeline';
      flag_type: AttentionFlagType;
      severity: AttentionFlagSeverity;
      reason: string;
      recommended_action: string;
      owner: 'human';
      status: 'open';
    }> = [];

    const flagsToUpdate: Array<{
      id: string;
      reason: string;
      recommended_action: string;
      updated_at: string;
    }> = [];

    for (const cp of companyProducts) {
      // Normalize current_stage join using firstOrNull to handle array/object inconsistencies
      const stage = firstOrNull(cp.current_stage as { id: string; name: string; slug: string; stage_order: number } | { id: string; name: string; slug: string; stage_order: number }[] | null);
      const stageName = stage?.name || null;
      const stageSlug = stage?.slug || '';

      // Determine the reference date for staleness
      const referenceDate = cp.last_stage_moved_at
        ? new Date(cp.last_stage_moved_at)
        : new Date(cp.created_at);

      const daysInStage = daysBetween(referenceDate, now);
      const threshold = getStaleThreshold(stageName);

      // ----------------------------------------
      // STALE_IN_STAGE check
      // ----------------------------------------
      const staleKey = `${cp.id}:STALE_IN_STAGE`;
      const existingStaleId = existingFlagMap.get(staleKey);

      if (daysInStage > threshold) {
        // Condition still applies - create or update flag
        const severity = getStaleSeverity(daysInStage, threshold);
        const reason = `No movement in stage for ${daysInStage} days`;
        const recommendedAction = 'Send follow-up + propose next step';

        if (existingStaleId) {
          flagsStillValid.add(existingStaleId);
          flagsToUpdate.push({
            id: existingStaleId,
            reason,
            recommended_action: recommendedAction,
            updated_at: nowIso,
          });
        } else {
          flagsToInsert.push({
            company_id: cp.company_id,
            company_product_id: cp.id,
            source_type: 'pipeline',
            flag_type: 'STALE_IN_STAGE',
            severity,
            reason,
            recommended_action: recommendedAction,
            owner: 'human',
            status: 'open',
          });
        }
      }
      // If daysInStage <= threshold and flag exists, it will be resolved later
      // (not added to flagsStillValid)

      // ----------------------------------------
      // NO_NEXT_STEP_AFTER_MEETING check
      // ----------------------------------------
      const noNextStepKey = `${cp.id}:NO_NEXT_STEP_AFTER_MEETING`;
      const existingNoNextStepId = existingFlagMap.get(noNextStepKey);

      const lastMeeting = lastMeetingMap.get(cp.company_id);
      const nextStepDue = cp.next_step_due_at ? new Date(cp.next_step_due_at) : null;
      const nextStepInFuture = nextStepDue && nextStepDue > now;
      const nextStepOverdue = nextStepDue && nextStepDue < now;
      const noNextStep = !nextStepDue || nextStepOverdue;

      // Resolution condition: next_step_due_at exists and is in the future
      if (nextStepInFuture) {
        // Condition no longer applies - flag will be resolved later
        // (not added to flagsStillValid)
      } else if (lastMeeting && noNextStep) {
        const daysSinceMeeting = daysBetween(lastMeeting, now);
        if (daysSinceMeeting <= 7) {
          // Only flag if meeting was recent (within 7 days)
          const reason = nextStepOverdue
            ? `Next step was due ${daysBetween(nextStepDue!, now)} days ago`
            : `No next step scheduled after meeting ${daysSinceMeeting} days ago`;
          const recommendedAction = 'Schedule follow-up meeting or call';

          if (existingNoNextStepId) {
            flagsStillValid.add(existingNoNextStepId);
            flagsToUpdate.push({
              id: existingNoNextStepId,
              reason,
              recommended_action: recommendedAction,
              updated_at: nowIso,
            });
          } else {
            flagsToInsert.push({
              company_id: cp.company_id,
              company_product_id: cp.id,
              source_type: 'pipeline',
              flag_type: 'NO_NEXT_STEP_AFTER_MEETING',
              severity: 'medium',
              reason,
              recommended_action: recommendedAction,
              owner: 'human',
              status: 'open',
            });
          }
        }
      }

      // ----------------------------------------
      // GHOSTING_AFTER_PROPOSAL check
      // ----------------------------------------
      const ghostingKey = `${cp.id}:GHOSTING_AFTER_PROPOSAL`;
      const existingGhostingId = existingFlagMap.get(ghostingKey);

      const isProposalStage =
        stageSlug.includes('proposal') ||
        stageSlug.includes('negotiat') ||
        stageName?.toLowerCase().includes('proposal') ||
        stageName?.toLowerCase().includes('negotiat');

      const lastInbound = lastInboundMap.get(cp.company_id);
      const daysSinceInbound = lastInbound ? daysBetween(lastInbound, now) : Infinity;

      // Resolution condition: inbound communication within 2 days
      if (daysSinceInbound <= GHOSTING_RESOLVE_THRESHOLD_DAYS) {
        // Condition no longer applies - flag will be resolved later
        // (not added to flagsStillValid)
      } else if (isProposalStage && daysSinceInbound >= GHOSTING_THRESHOLD_DAYS) {
        const reason = lastInbound
          ? `No response in ${daysSinceInbound} days after proposal`
          : 'No inbound communication since proposal stage';
        const recommendedAction = 'Send breakup email or try alternative channel';

        if (existingGhostingId) {
          flagsStillValid.add(existingGhostingId);
          flagsToUpdate.push({
            id: existingGhostingId,
            reason,
            recommended_action: recommendedAction,
            updated_at: nowIso,
          });
        } else {
          flagsToInsert.push({
            company_id: cp.company_id,
            company_product_id: cp.id,
            source_type: 'pipeline',
            flag_type: 'GHOSTING_AFTER_PROPOSAL',
            severity: 'high',
            reason,
            recommended_action: recommendedAction,
            owner: 'human',
            status: 'open',
          });
        }
      }
    }

    // ============================================
    // 6. Insert new flags
    // ============================================

    if (flagsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('attention_flags')
        .insert(flagsToInsert);

      if (insertError) {
        console.error('[GenerateStallFlags] Error inserting flags:', insertError);
        throw insertError;
      }

      created = flagsToInsert.length;
      console.log(`[GenerateStallFlags] Inserted ${created} new flags`);
    }

    // ============================================
    // 7. Update existing flags
    // ============================================

    for (const flag of flagsToUpdate) {
      const { error: updateError } = await supabase
        .from('attention_flags')
        .update({
          reason: flag.reason,
          recommended_action: flag.recommended_action,
          updated_at: flag.updated_at,
        })
        .eq('id', flag.id);

      if (updateError) {
        console.error(`[GenerateStallFlags] Error updating flag ${flag.id}:`, updateError);
      } else {
        updated++;
      }
    }

    console.log(`[GenerateStallFlags] Updated ${updated} existing flags`);

    // ============================================
    // 8. Resolve flags that no longer apply
    // ============================================

    // Find existing flags that should be resolved (not in flagsStillValid set)
    const flagsToResolve = (existingFlags || [])
      .filter((flag) => !flagsStillValid.has(flag.id))
      .map((flag) => flag.id);

    if (flagsToResolve.length > 0) {
      const { error: resolveError } = await supabase
        .from('attention_flags')
        .update({
          status: 'resolved',
          resolved_at: nowIso,
          updated_at: nowIso,
        })
        .in('id', flagsToResolve);

      if (resolveError) {
        console.error('[GenerateStallFlags] Error resolving flags:', resolveError);
      } else {
        resolved = flagsToResolve.length;
        console.log(`[GenerateStallFlags] Resolved ${resolved} flags (conditions no longer apply)`);
      }
    }

    // ============================================
    // 9. Return results
    // ============================================

    const result = {
      success: true,
      created,
      updated,
      resolved,
      processed: companyProducts.length,
      debug: {
        total_company_products: totalCompanyProducts,
        with_current_stage_id: withCurrentStageId,
        eligible_after_terminal_exclusion: eligibleAfterTerminalExclusion,
      },
      message: `Generated ${created} new flags, updated ${updated} existing, resolved ${resolved} stale flags`,
    };

    console.log('[GenerateStallFlags] Job completed successfully:', JSON.stringify(result));

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GenerateStallFlags] Job failed with error:', errorMessage);
    console.error('[GenerateStallFlags] Full error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
