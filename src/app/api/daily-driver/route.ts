/**
 * Daily Driver API
 *
 * GET - Returns prioritized lists for daily sales execution:
 * - needsReply: Communications awaiting our response (from response queue)
 * - needsHuman: Open attention flags requiring human decision
 * - stalled: Deals stuck or ghosting
 * - readyToClose: Deals ready for final close
 *
 * Query params:
 * - includeSnoozed=true: Include snoozed flags in needsHuman/stalled
 * - debug=true: Include extra fields (attention_flag_id, source_type, source_id)
 *
 * Intelligence comes from AI analysis, not keyword matching.
 * Daily Driver is a decision queue: no new AI reasoning here, only composition.
 *
 * Integration Notes:
 * - Response Queue: Queries communications table where awaiting_our_response=true
 * - Scheduler: BOOK_MEETING_APPROVAL and SYSTEM_ERROR flags appear in needsHuman
 * - Transcript Follow-ups: NO_NEXT_STEP_AFTER_MEETING flags appear in stalled
 *
 * =============================================================================
 * TESTING INSTRUCTIONS
 * =============================================================================
 *
 * 1. Test NEEDS_REPLY items:
 *    - Insert a test row into communications:
 *      INSERT INTO communications (company_id, awaiting_our_response, responded_at, subject, content_preview, channel, direction)
 *      VALUES ('<company-uuid>', true, null, 'Test Subject', 'Test preview...', 'email', 'inbound');
 *    - Refresh /daily and verify it appears in the attention level sections
 *    - Click "Mark Done" and verify it disappears
 *
 * 2. Test BOOK_MEETING_APPROVAL flags:
 *    - POST /api/attention-flags/create with:
 *      { "company_id": "<uuid>", "flag_type": "BOOK_MEETING_APPROVAL", "severity": "medium",
 *        "reason": "Meeting booking needs approval", "recommended_action": "Approve or reschedule" }
 *    - Verify it appears in the needsHuman section on /daily
 *    - Use resolve endpoint to clear it
 *
 * 3. Test SYSTEM_ERROR flags:
 *    - POST /api/attention-flags/create with:
 *      { "company_id": "<uuid>", "flag_type": "SYSTEM_ERROR", "severity": "high",
 *        "reason": "Email delivery failed", "recommended_action": "Check integration" }
 *    - Verify it appears with high priority (attention_level: "now")
 *
 * 4. Test byAttentionLevel grouping:
 *    - GET /api/daily-driver?debug=true
 *    - Verify response has byAttentionLevel.now, byAttentionLevel.soon, byAttentionLevel.monitor
 *    - Verify counts.needsReply matches needsReply array length
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstOrNull } from '@/lib/supabase/normalize';
import {
  DailyDriverItem,
  DailyDriverResponse,
  DailyDriverItemsByLevel,
  AttentionFlagType,
  AttentionFlagSeverity,
  AttentionFlagSourceType,
  AttentionLevel,
} from '@/types/operatingLayer';

// Flag types that require human decision/approval (Needs Human Attention section)
const NEEDS_HUMAN_FLAG_TYPES: AttentionFlagType[] = [
  'NEEDS_REPLY',
  'BOOK_MEETING_APPROVAL',
  'PROPOSAL_APPROVAL',
  'PRICING_EXCEPTION',
  'CLOSE_DECISION',
  'HIGH_RISK_OBJECTION',
  'DATA_MISSING_BLOCKER',
  'SYSTEM_ERROR',
];

// Flag types that indicate stalled deals (Stalled / At Risk section)
const STALLED_FLAG_TYPES: AttentionFlagType[] = [
  'STALE_IN_STAGE',
  'NO_NEXT_STEP_AFTER_MEETING',
  'GHOSTING_AFTER_PROPOSAL',
];

// Flag types that block closing
const CLOSE_BLOCKING_FLAG_TYPES: AttentionFlagType[] = [
  'HIGH_RISK_OBJECTION',
  'PRICING_EXCEPTION',
  'PROPOSAL_APPROVAL',
];

// Severity order for sorting (lower = more urgent)
const SEVERITY_ORDER: Record<AttentionFlagSeverity, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

/**
 * Determine attention level based on item characteristics.
 *
 * Rules:
 * - "now": Needs immediate action today
 *   - needsHuman flags with critical/high severity
 *   - readyToClose items (deals ready to win)
 * - "soon": Action needed this week
 *   - needsHuman flags with medium/low severity
 *   - stalled flags with critical/high severity (urgent stalls)
 * - "monitor": Informational, keep an eye on
 *   - stalled flags with medium/low severity (early warnings)
 */
function determineAttentionLevel(
  source: 'attention_flag' | 'company_product',
  flagType: AttentionFlagType | null,
  severity: AttentionFlagSeverity | null,
  isReadyToClose: boolean
): AttentionLevel {
  // Ready to close items are always "now" - these are wins waiting to happen
  if (isReadyToClose) {
    return 'now';
  }

  // Needs Human flags
  if (flagType && NEEDS_HUMAN_FLAG_TYPES.includes(flagType)) {
    if (severity === 'critical' || severity === 'high') {
      return 'now';
    }
    return 'soon';
  }

  // Stalled flags
  if (flagType && STALLED_FLAG_TYPES.includes(flagType)) {
    if (severity === 'critical' || severity === 'high') {
      return 'soon';
    }
    return 'monitor';
  }

  // Default fallback
  return 'soon';
}

/**
 * Transform raw database rows into normalized DailyDriverItem
 */
function transformToItem(
  row: Record<string, unknown>,
  source: 'attention_flag' | 'company_product' | 'communication'
): DailyDriverItem {
  if (source === 'attention_flag') {
    // Normalize all joins using firstOrNull to handle array/object inconsistencies
    const company = firstOrNull(row.company as Record<string, unknown> | Record<string, unknown>[] | null);
    const companyProduct = firstOrNull(row.company_product as Record<string, unknown> | Record<string, unknown>[] | null);
    const product = firstOrNull(companyProduct?.product as Record<string, unknown> | Record<string, unknown>[] | null);
    const stage = firstOrNull(companyProduct?.current_stage as Record<string, unknown> | Record<string, unknown>[] | null);
    const owner = firstOrNull(companyProduct?.owner as Record<string, unknown> | Record<string, unknown>[] | null);

    const flagType = row.flag_type as AttentionFlagType;
    const severity = row.severity as AttentionFlagSeverity;

    return {
      id: `af-${row.id}`,
      company_id: row.company_id as string,
      company_name: (company?.name as string) || 'Unknown Company',
      company_product_id: (row.company_product_id as string) || null,
      product_id: (product?.id as string) || null,
      product_name: (product?.name as string) || null,
      product_slug: (product?.slug as string) || null,
      contact_id: null,
      contact_name: null,
      contact_email: null,
      communication_id: null,
      communication_subject: null,
      communication_preview: null,
      response_due_by: null,
      stage_id: (stage?.id as string) || null,
      stage_name: (stage?.name as string) || null,
      stage_order: (stage?.stage_order as number) || null,
      attention_level: determineAttentionLevel(source, flagType, severity, false),
      attention_flag_id: row.id as string,
      flag_type: flagType,
      severity: severity,
      reason: row.reason as string,
      recommended_action: (row.recommended_action as string) || null,
      source_type: row.source_type as AttentionFlagSourceType,
      source_id: (row.source_id as string) || null,
      close_confidence: (companyProduct?.close_confidence as number) || null,
      close_ready: (companyProduct?.close_ready as boolean) || false,
      mrr_estimate: (companyProduct?.mrr as number) || null,
      owner_user_id: (owner?.id as string) || null,
      owner_name: (owner?.name as string) || null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      stage_entered_at: (companyProduct?.stage_entered_at as string) || null,
      last_stage_moved_at: (companyProduct?.last_stage_moved_at as string) || null,
    };
  } else if (source === 'communication') {
    // Communication source (for needsReply - response queue items)
    const company = firstOrNull(row.company as Record<string, unknown> | Record<string, unknown>[] | null);
    const contact = firstOrNull(row.contact as Record<string, unknown> | Record<string, unknown>[] | null);
    const analysis = firstOrNull(row.analysis as Record<string, unknown> | Record<string, unknown>[] | null);

    // Determine urgency based on response_due_by
    const responseDueBy = row.response_due_by as string | null;
    let attentionLevel: AttentionLevel = 'soon';
    if (responseDueBy) {
      const dueDate = new Date(responseDueBy);
      const now = new Date();
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue < 0) {
        attentionLevel = 'now'; // Overdue
      } else if (hoursUntilDue <= 4) {
        attentionLevel = 'now'; // Due very soon
      } else if (hoursUntilDue <= 24) {
        attentionLevel = 'soon'; // Due today
      } else {
        attentionLevel = 'monitor'; // Has time
      }
    }

    // Extract AI analysis data
    const aiSummary = (analysis?.summary as string) || null;
    const communicationType = (analysis?.communication_type as string) || null;
    const sentiment = (analysis?.sentiment as string) || null;
    const nextSteps = analysis?.extracted_next_steps as string[] | null;
    const signals = analysis?.extracted_signals as string[] | null;

    // Build recommended action from AI analysis
    let recommendedAction = 'Reply to this communication';
    if (nextSteps && nextSteps.length > 0) {
      recommendedAction = nextSteps[0];
    } else if (signals && signals.length > 0) {
      recommendedAction = `Address: ${signals[0]}`;
    }

    // Build reason/summary from AI analysis
    let reason = `Response needed${responseDueBy ? ` by ${new Date(responseDueBy).toLocaleDateString()}` : ''}`;
    if (aiSummary) {
      reason = aiSummary;
    } else if (communicationType) {
      reason = `${communicationType} - needs response`;
    }

    return {
      id: `comm-${row.id}`,
      company_id: (row.company_id as string) || '',
      company_name: (company?.name as string) || 'Unknown Company',
      company_product_id: null,
      product_id: null,
      product_name: null,
      product_slug: null,
      contact_id: (row.contact_id as string) || null,
      contact_name: (contact?.name as string) || null,
      contact_email: (contact?.email as string) || null,
      communication_id: row.id as string,
      communication_subject: (row.subject as string) || null,
      communication_preview: aiSummary || (row.content_preview as string) || null,
      response_due_by: responseDueBy,
      stage_id: null,
      stage_name: null,
      stage_order: null,
      attention_level: attentionLevel,
      attention_flag_id: null,
      flag_type: 'NEEDS_REPLY' as AttentionFlagType, // Virtual flag type for UI display
      severity: attentionLevel === 'now' ? 'high' : 'medium',
      reason: reason,
      recommended_action: recommendedAction,
      source_type: 'communication' as AttentionFlagSourceType,
      source_id: row.id as string,
      close_confidence: null,
      close_ready: false,
      mrr_estimate: null,
      owner_user_id: (row.user_id as string) || null,
      owner_name: null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      stage_entered_at: null,
      last_stage_moved_at: null,
    };
  } else {
    // company_product source (for readyToClose)
    // Normalize all joins using firstOrNull to handle array/object inconsistencies
    const company = firstOrNull(row.company as Record<string, unknown> | Record<string, unknown>[] | null);
    const product = firstOrNull(row.product as Record<string, unknown> | Record<string, unknown>[] | null);
    const stage = firstOrNull(row.current_stage as Record<string, unknown> | Record<string, unknown>[] | null);
    const owner = firstOrNull(row.owner as Record<string, unknown> | Record<string, unknown>[] | null);

    return {
      id: `cp-${row.id}`,
      company_id: row.company_id as string,
      company_name: (company?.name as string) || 'Unknown Company',
      company_product_id: row.id as string,
      product_id: (product?.id as string) || null,
      product_name: (product?.name as string) || null,
      product_slug: (product?.slug as string) || null,
      contact_id: null,
      contact_name: null,
      contact_email: null,
      communication_id: null,
      communication_subject: null,
      communication_preview: null,
      response_due_by: null,
      stage_id: (stage?.id as string) || null,
      stage_name: (stage?.name as string) || null,
      stage_order: (stage?.stage_order as number) || null,
      attention_level: determineAttentionLevel(source, null, null, true), // readyToClose = "now"
      attention_flag_id: null,
      flag_type: null,
      severity: null,
      reason: null,
      recommended_action: null,
      source_type: null,
      source_id: null,
      close_confidence: (row.close_confidence as number) || null,
      close_ready: (row.close_ready as boolean) || false,
      mrr_estimate: (row.mrr as number) || 1000, // Default to 1000 if no pricing
      owner_user_id: (owner?.id as string) || null,
      owner_name: (owner?.name as string) || null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      stage_entered_at: (row.stage_entered_at as string) || null,
      last_stage_moved_at: (row.last_stage_moved_at as string) || null,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const includeSnoozed = searchParams.get('includeSnoozed') === 'true';
    const debug = searchParams.get('debug') === 'true';

    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // ============================================
    // 0. NEEDS REPLY - Communications awaiting our response
    // ============================================
    // Source: communications table where awaiting_our_response=true
    // This is the "response queue" integrated into Daily Driver
    //
    // AUTOPILOT FILTER: Exclude communications that AI has already handled
    // This ensures Daily Driver shows only items needing human attention
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: aiHandledComms } = await supabase
      .from('ai_action_log')
      .select('communication_id')
      .eq('source', 'communications')
      .eq('status', 'success')
      .in('action_type', ['EMAIL_SENT', 'FLAG_CREATED'])
      .gte('created_at', twentyFourHoursAgo)
      .not('communication_id', 'is', null);

    const aiHandledCommIds = (aiHandledComms || [])
      .map((row) => row.communication_id)
      .filter(Boolean) as string[];

    let needsReplyQuery = supabase
      .from('communications')
      .select(`
        id,
        company_id,
        contact_id,
        user_id,
        subject,
        content_preview,
        response_due_by,
        created_at,
        updated_at,
        current_analysis_id,
        company:companies(id, name),
        contact:contacts(id, name, email),
        analysis:communication_analysis!communications_current_analysis_id_fkey(
          summary,
          communication_type,
          sentiment,
          extracted_next_steps,
          extracted_signals
        )
      `)
      .eq('awaiting_our_response', true)
      .is('responded_at', null)
      .order('response_due_by', { ascending: true, nullsFirst: false });

    // Exclude AI-handled communications
    if (aiHandledCommIds.length > 0) {
      needsReplyQuery = needsReplyQuery.not('id', 'in', `(${aiHandledCommIds.join(',')})`);
    }

    const { data: needsReplyRaw, error: needsReplyError } = await needsReplyQuery;

    if (needsReplyError) {
      console.error('[DailyDriver] Error fetching needsReply:', needsReplyError);
      throw needsReplyError;
    }

    // Transform and sort by urgency (overdue first, then due soon)
    const needsReply: DailyDriverItem[] = (needsReplyRaw || [])
      .map((row) => transformToItem(row as Record<string, unknown>, 'communication'))
      .sort((a, b) => {
        // Sort by attention level first (now > soon > monitor)
        const levelOrder = { now: 1, soon: 2, monitor: 3 };
        const levelDiff = levelOrder[a.attention_level] - levelOrder[b.attention_level];
        if (levelDiff !== 0) return levelDiff;
        // Then by response_due_by
        if (a.response_due_by && b.response_due_by) {
          return new Date(a.response_due_by).getTime() - new Date(b.response_due_by).getTime();
        }
        return 0;
      });

    // ============================================
    // 1. NEEDS HUMAN - Flags requiring human decision/approval
    // ============================================
    // Filter by specific flag types, NOT by severity
    // This ensures flags don't appear in multiple sections
    let needsHumanQuery = supabase
      .from('attention_flags')
      .select(`
        *,
        company:companies(id, name),
        company_product:company_products(
          id,
          close_confidence,
          close_ready,
          mrr,
          stage_entered_at,
          last_stage_moved_at,
          product:products(id, name, slug),
          current_stage:product_sales_stages(id, name, stage_order),
          owner:users(id, name)
        )
      `)
      .eq('status', 'open')
      .in('flag_type', NEEDS_HUMAN_FLAG_TYPES);

    // Filter out snoozed flags unless includeSnoozed is true
    if (!includeSnoozed) {
      needsHumanQuery = needsHumanQuery.or(`snoozed_until.is.null,snoozed_until.lt.${nowIso}`);
    }

    const { data: needsHumanRaw, error: needsHumanError } = await needsHumanQuery
      .order('created_at', { ascending: true });

    if (needsHumanError) {
      console.error('[DailyDriver] Error fetching needsHuman:', needsHumanError);
      throw needsHumanError;
    }

    // Transform and sort by severity desc then created_at asc
    const needsHuman: DailyDriverItem[] = (needsHumanRaw || [])
      .map((row) => transformToItem(row, 'attention_flag'))
      .sort((a, b) => {
        const severityDiff =
          SEVERITY_ORDER[a.severity || 'low'] - SEVERITY_ORDER[b.severity || 'low'];
        if (severityDiff !== 0) return severityDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    // ============================================
    // 2. STALLED - Open flags for stale/ghosting deals
    // ============================================
    let stalledQuery = supabase
      .from('attention_flags')
      .select(`
        *,
        company:companies(id, name),
        company_product:company_products(
          id,
          close_confidence,
          close_ready,
          mrr,
          stage_entered_at,
          last_stage_moved_at,
          product:products(id, name, slug),
          current_stage:product_sales_stages(id, name, stage_order),
          owner:users(id, name)
        )
      `)
      .eq('status', 'open')
      .in('flag_type', STALLED_FLAG_TYPES);

    // Filter out snoozed flags unless includeSnoozed is true
    if (!includeSnoozed) {
      stalledQuery = stalledQuery.or(`snoozed_until.is.null,snoozed_until.lt.${nowIso}`);
    }

    const { data: stalledRaw, error: stalledError } = await stalledQuery
      .order('created_at', { ascending: true });

    if (stalledError) {
      console.error('[DailyDriver] Error fetching stalled:', stalledError);
      throw stalledError;
    }

    const stalled: DailyDriverItem[] = (stalledRaw || [])
      .map((row) => transformToItem(row, 'attention_flag'))
      .sort((a, b) => {
        const severityDiff =
          SEVERITY_ORDER[a.severity || 'low'] - SEVERITY_ORDER[b.severity || 'low'];
        if (severityDiff !== 0) return severityDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    // ============================================
    // 3. READY TO CLOSE - High confidence deals without blocking flags
    // ============================================

    // First get IDs of company_products that have blocking flags
    const { data: blockedProductIds } = await supabase
      .from('attention_flags')
      .select('company_product_id')
      .eq('status', 'open')
      .in('flag_type', CLOSE_BLOCKING_FLAG_TYPES)
      .not('company_product_id', 'is', null);

    const blockedIds = new Set(
      (blockedProductIds || [])
        .map((r) => r.company_product_id)
        .filter(Boolean)
    );

    // Get company products that are ready to close
    const { data: readyToCloseRaw, error: readyToCloseError } = await supabase
      .from('company_products')
      .select(`
        *,
        company:companies(id, name),
        product:products(id, name, slug),
        current_stage:product_sales_stages(id, name, stage_order),
        owner:users(id, name)
      `)
      .eq('status', 'in_sales')
      .or('close_ready.eq.true,close_confidence.gte.75')
      .order('close_confidence', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: true });

    if (readyToCloseError) {
      console.error('[DailyDriver] Error fetching readyToClose:', readyToCloseError);
      throw readyToCloseError;
    }

    // Filter out blocked products and transform
    const readyToClose: DailyDriverItem[] = (readyToCloseRaw || [])
      .filter((row) => !blockedIds.has(row.id))
      .map((row) => {
        const item = transformToItem(row, 'company_product');
        // Ensure MRR estimate has a default
        if (!item.mrr_estimate) {
          item.mrr_estimate = 1000;
        }
        return item;
      });

    // ============================================
    // Build response
    // ============================================

    // Helper to strip debug-only fields when debug=false
    // NOTE: attention_flag_id is NOT stripped - it's needed for Draft Follow-up functionality
    const stripDebugFields = (items: DailyDriverItem[]): DailyDriverItem[] => {
      if (debug) return items;
      return items.map((item) => ({
        ...item,
        // Keep attention_flag_id - needed for actions like Draft Follow-up, Resolve, Snooze
        source_type: null,
        source_id: null,
      }));
    };

    // Combine all items and group by attention level
    // Include needsReply in the attention level grouping
    const allItems = [...needsReply, ...needsHuman, ...stalled, ...readyToClose];
    const byAttentionLevel: DailyDriverItemsByLevel = {
      now: allItems.filter((i) => i.attention_level === 'now'),
      soon: allItems.filter((i) => i.attention_level === 'soon'),
      monitor: allItems.filter((i) => i.attention_level === 'monitor'),
    };

    const response: DailyDriverResponse = {
      needsReply: stripDebugFields(needsReply),
      needsHuman: stripDebugFields(needsHuman),
      stalled: stripDebugFields(stalled),
      readyToClose: stripDebugFields(readyToClose),
      byAttentionLevel: {
        now: stripDebugFields(byAttentionLevel.now),
        soon: stripDebugFields(byAttentionLevel.soon),
        monitor: stripDebugFields(byAttentionLevel.monitor),
      },
      counts: {
        needsReply: needsReply.length,
        needsHuman: needsHuman.length,
        stalled: stalled.length,
        readyToClose: readyToClose.length,
        total: needsReply.length + needsHuman.length + stalled.length + readyToClose.length,
        now: byAttentionLevel.now.length,
        soon: byAttentionLevel.soon.length,
        monitor: byAttentionLevel.monitor.length,
      },
      needsHumanBySeverity: {
        critical: needsHuman.filter((i) => i.severity === 'critical').length,
        high: needsHuman.filter((i) => i.severity === 'high').length,
        medium: needsHuman.filter((i) => i.severity === 'medium').length,
      },
      meta: {
        generatedAt: nowIso,
        includeSnoozed,
        debug,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[DailyDriver] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
