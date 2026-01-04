/**
 * Command Center API - Unified View
 *
 * NOTE: This API is now primarily consumed by the Work Queue (/work) rather than
 * the Command Center UI (which was removed from navigation). The Work Queue fetches
 * Meeting Prep items from this endpoint.
 *
 * Combines Daily Driver's source-table queries with AI enrichment.
 * Uses attention levels (now/soon/monitor) instead of 5-tier system.
 *
 * Data Sources (queried directly for live progress):
 * - communications: where awaiting_our_response=true (needsReply)
 * - attention_flags: NEEDS_HUMAN_FLAG_TYPES (needsHuman)
 * - attention_flags: STALLED_FLAG_TYPES (stalled)
 * - company_products: close_ready=true or close_confidence>=75 (readyToClose)
 *
 * Enrichment:
 * - AI-generated context_brief and why_now for top items
 * - Already-handled detection
 * - Calendar integration with meeting prep
 *
 * GET - Get today's plan with items grouped by attention level
 * POST - Manually create a new item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { firstOrNull } from '@/lib/supabase/normalize';
import {
  getDailyPlan,
  generateDailyPlan,
  calculateMomentumScore,
  getDuration,
  getRepTimeProfile,
  getCurrentBlockIndex,
  findDealForCompany,
  generateWhyNow,
  enrichItem,
  batchDetectAlreadyHandled,
} from '@/lib/commandCenter';
import {
  CommandCenterItem,
  CreateItemRequest,
  GetDailyPlanResponse,
  PriorityTier,
} from '@/types/commandCenter';
import {
  AttentionFlagType,
  AttentionFlagSeverity,
  AttentionFlagSourceType,
  AttentionLevel,
} from '@/types/operatingLayer';

// ============================================
// DAILY DRIVER FLAG TYPE CONFIGURATION
// ============================================

// Flag types that require human decision/approval
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

// Flag types that indicate stalled deals
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
 * This is the core prioritization logic from Daily Driver.
 */
function determineAttentionLevel(
  source: 'attention_flag' | 'company_product' | 'communication',
  flagType: AttentionFlagType | null,
  severity: AttentionFlagSeverity | null,
  isReadyToClose: boolean,
  responseDueBy?: string | null
): AttentionLevel {
  // Ready to close items are always "now"
  if (isReadyToClose) {
    return 'now';
  }

  // Communications: determine by response due time
  if (source === 'communication' && responseDueBy) {
    const dueDate = new Date(responseDueBy);
    const now = new Date();
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilDue < 0) return 'now'; // Overdue
    if (hoursUntilDue <= 4) return 'now'; // Due very soon
    if (hoursUntilDue <= 24) return 'soon'; // Due today
    return 'monitor'; // Has time
  }

  // Default for communications without due date
  if (source === 'communication') {
    return 'soon';
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

  return 'soon';
}

// ============================================
// ITEM TRANSFORMATION
// ============================================

interface UnifiedItem extends CommandCenterItem {
  attention_level: AttentionLevel;
  source_table: 'communication' | 'attention_flag' | 'company_product';
  // Daily Driver fields for compatibility
  attention_flag_id?: string | null;
  flag_type?: AttentionFlagType | null;
  severity?: AttentionFlagSeverity | null;
  reason?: string | null;
  recommended_action?: string | null;
  source_type?: AttentionFlagSourceType | null;
  communication_id?: string | null;
  communication_subject?: string | null;
  communication_preview?: string | null;
  response_due_by?: string | null;
  close_confidence?: number | null;
  close_ready?: boolean;
  mrr_estimate?: number | null;
}

/**
 * Transform a communication row into a unified item
 */
function transformCommunication(row: Record<string, unknown>): UnifiedItem {
  const company = firstOrNull(row.company as Record<string, unknown> | Record<string, unknown>[] | null);
  const contact = firstOrNull(row.contact as Record<string, unknown> | Record<string, unknown>[] | null);
  const analysis = firstOrNull(row.analysis as Record<string, unknown> | Record<string, unknown>[] | null);
  const companyProduct = firstOrNull(row.company_product as Record<string, unknown> | Record<string, unknown>[] | null);
  const product = companyProduct ? firstOrNull(companyProduct.product as Record<string, unknown> | Record<string, unknown>[] | null) : null;

  const responseDueBy = row.response_due_by as string | null;
  const attentionLevel = determineAttentionLevel('communication', null, null, false, responseDueBy);

  // Extract AI analysis data
  const aiSummary = (analysis?.summary as string) || null;
  const nextSteps = analysis?.extracted_next_steps as string[] | null;
  const signals = analysis?.extracted_signals as string[] | null;

  // Build recommended action from AI analysis
  let recommendedAction = 'Reply to this communication';
  if (nextSteps && nextSteps.length > 0) {
    recommendedAction = nextSteps[0];
  } else if (signals && signals.length > 0) {
    recommendedAction = `Address: ${signals[0]}`;
  }

  // Build reason from AI analysis
  let reason = `Response needed${responseDueBy ? ` by ${new Date(responseDueBy).toLocaleDateString()}` : ''}`;
  if (aiSummary) {
    reason = aiSummary;
  }

  return {
    id: `comm-${row.id}`,
    user_id: (row.user_id as string) || '',
    action_type: 'respond_email',
    title: (row.subject as string) || 'Email Response Needed',
    description: aiSummary || (row.content_preview as string) || null,
    company_id: (row.company_id as string) || null,
    company_name: (company?.name as string) || null,
    contact_id: (row.contact_id as string) || null,
    target_name: (contact?.name as string) || null,
    deal_id: null,
    deal_value: null,
    deal_probability: null,
    deal_stage: null,
    momentum_score: 0,
    base_priority: 0,
    time_pressure: 0,
    value_score: 0,
    engagement_score: 0,
    risk_score: 0,
    estimated_minutes: 10,
    due_at: responseDueBy,
    status: 'pending',
    source: 'communication',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    // Required CommandCenterItem fields
    tier: 1 as const,
    score_factors: {},
    score_explanation: [],
    snooze_count: 0,
    skip_count: 0,
    primary_action_label: 'Reply',
    // Unified fields
    attention_level: attentionLevel,
    source_table: 'communication',
    // Daily Driver compatibility
    attention_flag_id: null,
    flag_type: 'NEEDS_REPLY' as AttentionFlagType,
    severity: attentionLevel === 'now' ? 'high' : 'medium',
    reason,
    recommended_action: recommendedAction,
    source_type: 'communication' as AttentionFlagSourceType,
    source_id: row.id as string,
    communication_id: row.id as string,
    communication_subject: (row.subject as string) || null,
    communication_preview: aiSummary || (row.content_preview as string) || null,
    response_due_by: responseDueBy,
    // Use AI summary as context brief
    context_brief: aiSummary,
    why_now: reason,
    // Contact info for actions
    contact: contact ? {
      id: contact.id as string,
      name: (contact.name as string) || null,
      email: (contact.email as string) || null,
    } : undefined,
    // Product info
    company_product_id: (companyProduct?.id as string) || null,
    product_name: (product?.name as string) || null,
    product_status: (companyProduct?.status as string) || null,
    product_mrr: (companyProduct?.mrr as number) || null,
  } as UnifiedItem;
}

/**
 * Transform an attention flag row into a unified item
 */
function transformAttentionFlag(row: Record<string, unknown>): UnifiedItem {
  const company = firstOrNull(row.company as Record<string, unknown> | Record<string, unknown>[] | null);
  const companyProduct = firstOrNull(row.company_product as Record<string, unknown> | Record<string, unknown>[] | null);
  const product = firstOrNull(companyProduct?.product as Record<string, unknown> | Record<string, unknown>[] | null);

  const flagType = row.flag_type as AttentionFlagType;
  const severity = row.severity as AttentionFlagSeverity;
  const attentionLevel = determineAttentionLevel('attention_flag', flagType, severity, false);

  // Determine action type based on flag
  let actionType = 'review_flag';
  if (flagType === 'NEEDS_REPLY') actionType = 'respond_email';
  else if (flagType === 'NO_NEXT_STEP_AFTER_MEETING') actionType = 'send_followup';
  else if (flagType === 'STALE_IN_STAGE' || flagType === 'GHOSTING_AFTER_PROPOSAL') actionType = 'send_followup';
  else if (flagType === 'BOOK_MEETING_APPROVAL') actionType = 'schedule_meeting';

  return {
    id: `af-${row.id}`,
    user_id: '',
    action_type: actionType,
    title: (row.reason as string) || `${flagType} Flag`,
    description: (row.recommended_action as string) || null,
    company_id: row.company_id as string,
    company_name: (company?.name as string) || null,
    contact_id: null,
    target_name: null,
    deal_id: null,
    deal_value: (companyProduct?.mrr as number) || null,
    deal_probability: null,
    deal_stage: null,
    momentum_score: 0,
    base_priority: 0,
    time_pressure: 0,
    value_score: 0,
    engagement_score: 0,
    risk_score: 0,
    estimated_minutes: 15,
    due_at: null,
    status: 'pending',
    source: 'attention_flag',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    // Required CommandCenterItem fields
    tier: (attentionLevel === 'now' ? 1 : attentionLevel === 'soon' ? 2 : 4) as 1 | 2 | 3 | 4 | 5,
    score_factors: {},
    score_explanation: [],
    snooze_count: 0,
    skip_count: 0,
    primary_action_label: 'Resolve',
    // Unified fields
    attention_level: attentionLevel,
    source_table: 'attention_flag',
    // Daily Driver compatibility
    attention_flag_id: row.id as string,
    flag_type: flagType,
    severity,
    reason: row.reason as string,
    recommended_action: (row.recommended_action as string) || null,
    source_type: row.source_type as AttentionFlagSourceType,
    source_id: (row.source_id as string) || null,
    communication_id: null,
    communication_subject: null,
    communication_preview: null,
    response_due_by: null,
    // Context
    context_brief: (row.reason as string) || null,
    why_now: (row.recommended_action as string) || `${flagType} needs attention`,
    // Product info
    company_product_id: companyProduct?.id as string || null,
    product_name: (product?.name as string) || null,
    product_status: (companyProduct?.status as string) || null,
    product_mrr: (companyProduct?.mrr as number) || null,
  } as UnifiedItem;
}

/**
 * Transform a company product row into a unified item (ready to close)
 */
function transformCompanyProduct(row: Record<string, unknown>): UnifiedItem {
  const company = firstOrNull(row.company as Record<string, unknown> | Record<string, unknown>[] | null);
  const product = firstOrNull(row.product as Record<string, unknown> | Record<string, unknown>[] | null);
  const stage = firstOrNull(row.current_stage as Record<string, unknown> | Record<string, unknown>[] | null);

  return {
    id: `cp-${row.id}`,
    user_id: '',
    action_type: 'close_deal',
    title: `Close ${(company?.name as string) || 'Deal'} - ${(product?.name as string) || 'Product'}`,
    description: `${(row.close_confidence as number) || 0}% close confidence`,
    company_id: row.company_id as string,
    company_name: (company?.name as string) || null,
    contact_id: null,
    target_name: null,
    deal_id: null,
    deal_value: (row.mrr as number) || 1000,
    deal_probability: (row.close_confidence as number) || 75,
    deal_stage: (stage?.name as string) || null,
    momentum_score: 0,
    base_priority: 0,
    time_pressure: 0,
    value_score: 0,
    engagement_score: 0,
    risk_score: 0,
    estimated_minutes: 30,
    due_at: null,
    status: 'pending',
    source: 'company_product',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    // Required CommandCenterItem fields
    tier: 1 as const,
    score_factors: {},
    score_explanation: [],
    snooze_count: 0,
    skip_count: 0,
    primary_action_label: 'Close',
    // Unified fields
    attention_level: 'now' as AttentionLevel, // Ready to close = highest priority
    source_table: 'company_product',
    // Daily Driver compatibility
    attention_flag_id: null,
    flag_type: null,
    severity: null,
    reason: null,
    recommended_action: 'Send close message',
    source_type: null,
    source_id: null,
    communication_id: null,
    communication_subject: null,
    communication_preview: null,
    response_due_by: null,
    close_confidence: (row.close_confidence as number) || null,
    close_ready: (row.close_ready as boolean) || false,
    mrr_estimate: (row.mrr as number) || 1000,
    // Context
    context_brief: `Ready to close with ${(row.close_confidence as number) || 75}% confidence`,
    why_now: 'High close confidence - seize the moment!',
    // Product info
    company_product_id: row.id as string,
    product_name: (product?.name as string) || null,
    product_status: (row.status as string) || 'in_sales',
    product_mrr: (row.mrr as number) || null,
  } as UnifiedItem;
}

// ============================================
// GET - Today's plan with items from source tables
// ============================================

export async function GET(request: NextRequest) {
  try {
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
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser.id;

    // Get user's timezone from profile to calculate correct local date
    const profile = await getRepTimeProfile(userId);
    const timezone = profile.timezone || 'America/New_York';

    // Check for date parameter (supports 'tomorrow' or YYYY-MM-DD)
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    // Get current date in user's timezone using Intl.DateTimeFormat
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(now); // Returns YYYY-MM-DD format

    // Parse the date parts
    let [year, month, day] = todayStr.split('-').map(Number);

    // Handle date parameter
    if (dateParam === 'tomorrow') {
      // Find the next work day, not just tomorrow
      const workDays = profile.work_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // Create date for iteration (use noon to avoid DST issues)
      let targetDate = new Date(year, month - 1, day, 12, 0, 0);
      let daysChecked = 0;

      do {
        targetDate.setDate(targetDate.getDate() + 1);
        daysChecked++;
        const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayName = dayNames[dayOfWeek];
        if (workDays.includes(dayName)) {
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
          break;
        }
      } while (daysChecked < 7); // Safety limit
    } else if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      [year, month, day] = dateParam.split('-').map(Number);
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Create userLocalDate for day-of-week checks later
    const userLocalDate = new Date(year, month - 1, day, 12, 0, 0);

    // Check if it's a work day
    const dayName = userLocalDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone });
    const isWorkDay = profile.work_days?.includes(dayName) ?? true;

    // ============================================
    // GENERATE DAILY PLAN (calendar integration)
    // ============================================
    let plan: Awaited<ReturnType<typeof getDailyPlan>> = null;
    try {
      plan = await generateDailyPlan(userId, userLocalDate);
    } catch (planError) {
      console.error('[CommandCenter] Error generating plan:', planError);
      plan = await getDailyPlan(userId, userLocalDate);

      if (!plan) {
        plan = {
          id: '',
          user_id: userId,
          plan_date: dateStr,
          total_work_minutes: 480,
          meeting_minutes: 0,
          prep_buffer_minutes: 0,
          reactive_buffer_minutes: 60,
          available_minutes: 420,
          planned_minutes: 0,
          time_blocks: [],
          planned_item_ids: [],
          total_potential_value: 0,
          completed_value: 0,
          items_planned: 0,
          items_completed: 0,
          completion_rate: 0,
          generated_at: new Date().toISOString(),
        } as unknown as typeof plan;
      }
    }

    const nowIso = now.toISOString();

    // ============================================
    // 1. NEEDS REPLY - Communications awaiting response
    // ============================================
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
        company_product_id,
        company:companies(id, name),
        contact:contacts(id, name, email),
        company_product:company_products(id, status, mrr, product:products(id, name, slug)),
        analysis:communication_analysis!communications_current_analysis_id_fkey(
          summary,
          communication_type,
          sentiment,
          extracted_next_steps,
          extracted_signals
        )
      `)
      .eq('user_id', userId)
      .eq('awaiting_our_response', true)
      .is('responded_at', null)
      .order('response_due_by', { ascending: true, nullsFirst: false });

    if (aiHandledCommIds.length > 0) {
      needsReplyQuery = needsReplyQuery.not('id', 'in', `(${aiHandledCommIds.join(',')})`);
    }

    const { data: needsReplyRaw } = await needsReplyQuery;
    const needsReplyItems = (needsReplyRaw || []).map(row =>
      transformCommunication(row as Record<string, unknown>)
    );

    // ============================================
    // 2. NEEDS HUMAN - Flags requiring human decision
    // ============================================
    const { data: needsHumanRaw } = await supabase
      .from('attention_flags')
      .select(`
        *,
        company:companies(id, name),
        company_product:company_products(
          id,
          owner_user_id,
          close_confidence,
          close_ready,
          mrr,
          stage_entered_at,
          last_stage_moved_at,
          product:products(id, name, slug),
          current_stage:product_process_stages(id, name, stage_order),
          owner_user:users(id, name)
        )
      `)
      .eq('status', 'open')
      .in('flag_type', NEEDS_HUMAN_FLAG_TYPES)
      .or(`snoozed_until.is.null,snoozed_until.lt.${nowIso}`)
      .order('created_at', { ascending: true });

    // Filter to only show flags for company_products owned by this user
    const needsHumanFiltered = (needsHumanRaw || []).filter(row => {
      const cp = row.company_product as Record<string, unknown> | null;
      if (!cp) return false; // No company_product = skip
      return cp.owner_user_id === userId;
    });
    const needsHumanItems = needsHumanFiltered.map(row =>
      transformAttentionFlag(row as Record<string, unknown>)
    );

    // ============================================
    // 3. STALLED - Flags for stale/ghosting deals
    // ============================================
    const { data: stalledRaw } = await supabase
      .from('attention_flags')
      .select(`
        *,
        company:companies(id, name),
        company_product:company_products(
          id,
          owner_user_id,
          close_confidence,
          close_ready,
          mrr,
          stage_entered_at,
          last_stage_moved_at,
          product:products(id, name, slug),
          current_stage:product_process_stages(id, name, stage_order),
          owner_user:users(id, name)
        )
      `)
      .eq('status', 'open')
      .in('flag_type', STALLED_FLAG_TYPES)
      .or(`snoozed_until.is.null,snoozed_until.lt.${nowIso}`)
      .order('created_at', { ascending: true });

    // Filter to only show flags for company_products owned by this user
    const stalledFiltered = (stalledRaw || []).filter(row => {
      const cp = row.company_product as Record<string, unknown> | null;
      if (!cp) return false; // No company_product = skip
      return cp.owner_user_id === userId;
    });
    const stalledItems = stalledFiltered.map(row =>
      transformAttentionFlag(row as Record<string, unknown>)
    );

    // ============================================
    // 4. READY TO CLOSE - High confidence deals
    // ============================================
    const { data: blockedProductIds } = await supabase
      .from('attention_flags')
      .select('company_product_id')
      .eq('status', 'open')
      .in('flag_type', CLOSE_BLOCKING_FLAG_TYPES)
      .not('company_product_id', 'is', null);

    const blockedIds = new Set(
      (blockedProductIds || []).map(r => r.company_product_id).filter(Boolean)
    );

    const { data: readyToCloseRaw } = await supabase
      .from('company_products')
      .select(`
        *,
        company:companies(id, name),
        product:products(id, name, slug),
        current_stage:product_process_stages(id, name, stage_order),
        owner:users(id, name)
      `)
      .eq('owner_user_id', userId)
      .eq('status', 'in_sales')
      .or('close_ready.eq.true,close_confidence.gte.75')
      .order('close_confidence', { ascending: false, nullsFirst: false });

    const readyToCloseItems = (readyToCloseRaw || [])
      .filter(row => !blockedIds.has(row.id))
      .map(row => transformCompanyProduct(row as Record<string, unknown>));

    // ============================================
    // COMBINE AND GROUP BY ATTENTION LEVEL
    // ============================================
    const allItems: UnifiedItem[] = [
      ...needsReplyItems,
      ...needsHumanItems,
      ...stalledItems,
      ...readyToCloseItems,
    ];

    // Sort within each attention level
    const sortByUrgency = (a: UnifiedItem, b: UnifiedItem) => {
      // Sort by severity first
      const severityA = SEVERITY_ORDER[a.severity || 'low'] || 4;
      const severityB = SEVERITY_ORDER[b.severity || 'low'] || 4;
      if (severityA !== severityB) return severityA - severityB;

      // Then by due date
      if (a.response_due_by && b.response_due_by) {
        return new Date(a.response_due_by).getTime() - new Date(b.response_due_by).getTime();
      }
      if (a.response_due_by) return -1;
      if (b.response_due_by) return 1;

      // Then by value
      const valueA = a.deal_value || a.mrr_estimate || 0;
      const valueB = b.deal_value || b.mrr_estimate || 0;
      return valueB - valueA;
    };

    const nowItems = allItems.filter(i => i.attention_level === 'now').sort(sortByUrgency);
    const soonItems = allItems.filter(i => i.attention_level === 'soon').sort(sortByUrgency);
    const monitorItems = allItems.filter(i => i.attention_level === 'monitor').sort(sortByUrgency);

    console.log(`[CommandCenter] Attention levels: now=${nowItems.length}, soon=${soonItems.length}, monitor=${monitorItems.length}`);

    // ============================================
    // AI ENRICHMENT (for top items)
    // ============================================
    const topItemsForEnrichment = [...nowItems, ...soonItems].slice(0, 5);
    const itemsNeedingEnrichment = topItemsForEnrichment.filter(item => !item.context_brief);

    if (itemsNeedingEnrichment.length > 0) {
      console.log(`[CommandCenter] Enriching ${itemsNeedingEnrichment.length} items with AI context`);

      const enrichmentPromises = itemsNeedingEnrichment.map(async (item) => {
        try {
          const enrichment = await enrichItem(userId, item as CommandCenterItem);
          item.context_brief = enrichment.context_summary;
          if (enrichment.why_now) {
            item.why_now = enrichment.why_now;
          }
        } catch (err) {
          console.error(`[CommandCenter] Failed to enrich item ${item.id}:`, err);
        }
      });

      await Promise.all(enrichmentPromises);
    }

    // ============================================
    // BUILD RESPONSE
    // ============================================
    const timeBlocks = plan?.time_blocks || [];
    const calendarEventsCount = timeBlocks.filter(b => b.type === 'meeting').length;

    // Map attention levels to legacy tiers for backward compatibility
    // now -> tier 1, soon -> tier 2/3, monitor -> tier 4/5
    const tier1Items = nowItems;
    const tier2Items = soonItems.filter(i => i.severity === 'critical' || i.severity === 'high');
    const tier3Items = soonItems.filter(i => i.severity === 'medium' || !i.severity);
    const tier4Items = monitorItems.filter(i => i.severity === 'critical' || i.severity === 'high');
    const tier5Items = monitorItems.filter(i => i.severity !== 'critical' && i.severity !== 'high');

    const response: GetDailyPlanResponse = {
      success: true,
      plan: plan!,
      items: allItems as unknown as CommandCenterItem[],
      // Tier-grouped items (for backward compatibility)
      tier1_items: tier1Items as unknown as CommandCenterItem[],
      tier2_items: tier2Items as unknown as CommandCenterItem[],
      tier3_items: tier3Items as unknown as CommandCenterItem[],
      tier4_items: tier4Items as unknown as CommandCenterItem[],
      tier5_items: tier5Items as unknown as CommandCenterItem[],
      // NEW: Attention level grouping
      byAttentionLevel: {
        now: nowItems as unknown as CommandCenterItem[],
        soon: soonItems as unknown as CommandCenterItem[],
        monitor: monitorItems as unknown as CommandCenterItem[],
      },
      // Section counts
      counts: {
        needsReply: needsReplyItems.length,
        needsHuman: needsHumanItems.length,
        stalled: stalledItems.length,
        readyToClose: readyToCloseItems.length,
        total: allItems.length,
        now: nowItems.length,
        soon: soonItems.length,
        monitor: monitorItems.length,
      },
      // Legacy fields
      current_item: allItems[0] as unknown as CommandCenterItem || null,
      next_items: allItems.slice(1, 6) as unknown as CommandCenterItem[],
      at_risk_items: nowItems.slice(0, 5) as unknown as CommandCenterItem[],
      overflow_count: Math.max(0, allItems.length - 10),
      is_work_day: isWorkDay,
      debug: {
        server_time: now.toISOString(),
        queried_date: dateStr,
        day_name: dayName,
        is_work_day: isWorkDay,
        user_timezone: timezone,
        calendar_events_count: calendarEventsCount,
        tier_counts: {
          tier1: tier1Items.length,
          tier2: tier2Items.length,
          tier3: tier3Items.length,
          tier4: tier4Items.length,
          tier5: tier5Items.length,
        },
        attention_counts: {
          now: nowItems.length,
          soon: soonItems.length,
          monitor: monitorItems.length,
        },
        source_counts: {
          needsReply: needsReplyItems.length,
          needsHuman: needsHumanItems.length,
          stalled: stalledItems.length,
          readyToClose: readyToCloseItems.length,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[CommandCenter] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST - Create new item
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateItemRequest = await request.json();

    // Validate required fields
    if (!body.action_type || !body.title) {
      return NextResponse.json(
        { error: 'action_type and title are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser.id;

    // Get rep profile for duration calculation
    const profile = await getRepTimeProfile(userId);

    // Calculate duration
    const estimatedMinutes =
      body.estimated_minutes || getDuration(body.action_type, profile.action_durations);

    // Get deal info if provided
    let dealValue: number | null = null;
    let dealProbability: number | null = null;
    let dealStage: string | null = null;
    let companyId: string | null = body.company_id || null;
    let companyName: string | null = null;
    let resolvedDealId: string | null = body.deal_id || null;

    if (body.deal_id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('estimated_value, probability, stage, company_id, companies(name)')
        .eq('id', body.deal_id)
        .single();

      if (deal) {
        dealValue = deal.estimated_value;
        dealProbability = deal.probability;
        dealStage = deal.stage;
        companyId = deal.company_id;
        // Handle companies relation (could be object or array depending on join)
        const companies = deal.companies;
        if (companies) {
          if (Array.isArray(companies) && companies.length > 0) {
            companyName = companies[0].name || null;
          } else if (typeof companies === 'object' && 'name' in companies) {
            companyName = (companies as { name: string }).name || null;
          }
        }
      }
    } else if (body.company_id) {
      // No deal_id provided but we have company_id - try to find active deal
      const companyDeal = await findDealForCompany(body.company_id);
      if (companyDeal) {
        resolvedDealId = companyDeal.id;
        dealValue = companyDeal.estimated_value;
        dealProbability = companyDeal.probability;
        dealStage = companyDeal.stage;
      }

      // Get company name
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', body.company_id)
        .single();

      if (company) {
        companyName = company.name;
      }
    }

    // Get contact name if provided
    let targetName: string | null = null;
    if (body.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('id', body.contact_id)
        .single();

      if (contact) {
        targetName = contact.name;
      }
    }

    // Calculate momentum score with resolved deal values
    const scoreResult = calculateMomentumScore({
      action_type: body.action_type,
      due_at: body.due_at || null,
      deal_value: dealValue,
      deal_probability: dealProbability,
      deal_id: resolvedDealId,
      company_id: companyId,
    });

    // Generate why_now text
    const whyNow = generateWhyNow({
      action_type: body.action_type,
      due_at: body.due_at,
      deal_value: dealValue,
      deal_stage: dealStage,
    });

    // Build item
    const itemData = {
      user_id: userId,
      action_type: body.action_type,
      title: body.title,
      description: body.description || null,
      deal_id: resolvedDealId,
      company_id: companyId,
      contact_id: body.contact_id || null,
      deal_value: dealValue,
      deal_probability: dealProbability,
      deal_stage: dealStage,
      company_name: companyName,
      target_name: targetName,
      due_at: body.due_at || null,
      estimated_minutes: estimatedMinutes,
      momentum_score: scoreResult.score,
      score_factors: scoreResult.factors,
      score_explanation: scoreResult.explanation,
      base_priority: scoreResult.factors.base?.value || 0,
      time_pressure: scoreResult.factors.time?.value || 0,
      value_score: scoreResult.factors.value?.value || 0,
      engagement_score: scoreResult.factors.engagement?.value || 0,
      risk_score: scoreResult.factors.risk?.value || 0,
      why_now: whyNow,
      source: 'manual' as const,
      status: 'pending' as const,
      primary_action_label: 'Start',
    };

    const { data: newItem, error } = await supabase
      .from('command_center_items')
      .insert(itemData)
      .select()
      .single();

    if (error) {
      console.error('[CommandCenter] Error creating item:', error);
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (error) {
    console.error('[CommandCenter] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
