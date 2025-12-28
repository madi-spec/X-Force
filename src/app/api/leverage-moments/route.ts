import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkStopRules,
  detectTriggers,
  getTriggerContext,
  buildTrustBasis,
  generateBrief,
} from '@/lib/ai/leverage';

/**
 * GET /api/leverage-moments
 *
 * List pending leverage moments for the current user's deals.
 * Returns moments sorted by urgency and confidence.
 */
export async function GET(request: NextRequest) {
  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user profile
  const { data: profile } = await authSupabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'pending';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  // Get user's deals
  const { data: userDeals } = await supabase
    .from('deals')
    .select('id')
    .eq('owner_id', profile.id)
    .not('stage', 'in', '(closed_won,closed_lost)');

  const dealIds = userDeals?.map((d) => d.id) || [];

  console.log('[Leverage Moments] User profile.id:', profile.id);
  console.log('[Leverage Moments] User deals count:', dealIds.length);

  // First check: how many moments exist total?
  const { count: totalMoments } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true });
  console.log('[Leverage Moments] Total moments in DB:', totalMoments);

  if (dealIds.length === 0) {
    return NextResponse.json({ moments: [], total: 0, debug: { userDeals: 0, totalMoments } });
  }

  // Get leverage moments for user's deals
  const { data: moments, error, count } = await supabase
    .from('human_leverage_moments')
    .select(
      `
      *,
      company:companies(id, name),
      deal:deals(id, name, stage, estimated_value),
      contact:contacts(id, name, title)
    `,
      { count: 'exact' }
    )
    .in('deal_id', dealIds)
    .eq('status', status)
    .order('urgency', { ascending: true }) // immediate first
    .order('confidence', { ascending: false })
    .limit(limit);

  console.log('[Leverage Moments] Query for status:', status, '- found:', count);

  if (error) {
    console.error('[Leverage Moments] Error fetching:', error);
    return NextResponse.json({ error: 'Failed to fetch moments' }, { status: 500 });
  }

  // Sort by urgency priority
  const urgencyOrder = { immediate: 0, today: 1, this_week: 2, before_next_milestone: 3 };
  const sortedMoments = (moments || []).sort((a, b) => {
    const urgencyDiff = (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 4) -
                        (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 4);
    if (urgencyDiff !== 0) return urgencyDiff;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  return NextResponse.json({
    moments: sortedMoments,
    total: count || 0,
  });
}

/**
 * POST /api/leverage-moments
 *
 * Detect triggers for a deal and create leverage moments if appropriate.
 * Body: { dealId: string }
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const { dealId } = body;

  if (!dealId) {
    return NextResponse.json({ error: 'dealId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // Get trigger context
    const context = await getTriggerContext(dealId);
    if (!context) {
      return NextResponse.json({ error: 'Deal not found or no intelligence computed' }, { status: 404 });
    }

    // Detect triggers
    const triggers = await detectTriggers(context);

    if (triggers.length === 0) {
      return NextResponse.json({
        message: 'No triggers detected',
        triggersChecked: 4,
        momentsCreated: 0,
      });
    }

    const momentsCreated: string[] = [];
    const momentsBlocked: Array<{ type: string; reason: string }> = [];

    // Process each trigger
    for (const trigger of triggers) {
      // Check stop rules
      const stopCheck = await checkStopRules({
        userId: profile.id,
        dealId,
        companyId: context.companyId,
        triggerType: trigger.type,
        confidence: trigger.confidence,
        expectedValue: context.intelligence.expected_value,
      });

      if (!stopCheck.canCreate) {
        momentsBlocked.push({
          type: trigger.type,
          reason: stopCheck.reason || 'Blocked by stop rules',
        });
        continue;
      }

      // Build trust basis
      const trustBasis = await buildTrustBasis(trigger);

      // Generate brief
      const brief = await generateBrief(trigger, context, trustBasis);

      // Create leverage moment
      const { data: moment, error: createError } = await supabase
        .from('human_leverage_moments')
        .insert({
          company_id: context.companyId,
          deal_id: dealId,
          type: trigger.type,
          urgency: trigger.urgency,
          required_role: trigger.requiredRole,
          confidence: trigger.confidence,
          confidence_low: trigger.confidenceLow,
          confidence_high: trigger.confidenceHigh,
          confidence_label: brief.confidenceLabel,
          confidence_factors: trigger.signalSources,
          trust_basis: trustBasis,
          situation: brief.situation,
          why_it_matters: brief.whyItMatters,
          what_ai_did: brief.whatAiDid,
          what_human_must_do: brief.whatHumanMustDo,
          why_human: brief.whyHuman,
          talking_points: brief.talkingPoints,
          data_points: brief.dataPoints,
          avoid: brief.avoid,
          success_criteria: brief.successCriteria,
          if_unsuccessful: brief.ifUnsuccessful,
          status: 'pending',
          expires_at: calculateExpiration(trigger.urgency),
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[Leverage Moments] Error creating:', createError);
        continue;
      }

      if (moment) {
        momentsCreated.push(moment.id);
      }
    }

    return NextResponse.json({
      message: `Created ${momentsCreated.length} leverage moment(s)`,
      triggersDetected: triggers.length,
      momentsCreated: momentsCreated.length,
      momentIds: momentsCreated,
      blocked: momentsBlocked,
    });
  } catch (error) {
    console.error('[Leverage Moments] Error:', error);
    return NextResponse.json({ error: 'Failed to process triggers' }, { status: 500 });
  }
}

function calculateExpiration(urgency: string): string {
  const now = new Date();
  switch (urgency) {
    case 'immediate':
      now.setHours(now.getHours() + 24);
      break;
    case 'today':
      now.setHours(now.getHours() + 48);
      break;
    case 'this_week':
      now.setDate(now.getDate() + 7);
      break;
    default:
      now.setDate(now.getDate() + 14);
  }
  return now.toISOString();
}
