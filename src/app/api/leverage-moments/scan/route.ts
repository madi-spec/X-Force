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
import { computeDealIntelligence, DealData } from '@/lib/ai/intelligence';

/**
 * POST /api/leverage-moments/scan
 *
 * Scan all active deals for leverage moments.
 * Used by scheduled jobs or manual "scan for opportunities" button.
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
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const scope = searchParams.get('scope') || 'mine'; // 'mine' | 'all'

  // Get deals to scan
  let dealsQuery = supabase
    .from('deals')
    .select('id, company_id, owner_id')
    .not('stage', 'in', '(closed_won,closed_lost)');

  // If not admin/manager, only scan own deals
  if (scope === 'mine' || profile.role === 'rep') {
    dealsQuery = dealsQuery.eq('owner_id', profile.id);
  }

  const { data: deals } = await dealsQuery.limit(100);

  if (!deals || deals.length === 0) {
    return NextResponse.json({
      message: 'No deals to scan',
      dealsScanned: 0,
      momentsCreated: 0,
    });
  }

  const results = {
    dealsScanned: 0,
    intelligenceComputed: 0,
    triggersDetected: 0,
    momentsCreated: 0,
    momentsBlocked: 0,
    skipped: 0,
    errors: [] as string[],
    debug: [] as string[],
  };

  // Process each deal
  for (const deal of deals) {
    results.dealsScanned++;

    try {
      // Check if intelligence exists, compute if not
      let context = await getTriggerContext(deal.id);

      if (!context) {
        // Compute intelligence for this deal
        const intelligence = await computeIntelligenceForDeal(supabase, deal.id);
        if (!intelligence) {
          results.debug.push(`Deal ${deal.id}: Skipped - could not compute intelligence`);
          results.skipped++;
          continue;
        }
        results.intelligenceComputed++;
        results.debug.push(`Deal ${deal.id}: Computed intelligence`);

        // Try getting context again
        context = await getTriggerContext(deal.id);
        if (!context) {
          results.debug.push(`Deal ${deal.id}: Skipped - no context after computing intelligence`);
          results.skipped++;
          continue;
        }
      }

      // Log context for debugging
      results.debug.push(`Deal ${deal.id}: Stage=${context.deal.stage}, Activities=${context.recentActivities.length}, Contacts=${context.contacts.length}`);
      results.debug.push(`Deal ${deal.id}: Momentum=${context.intelligence.momentum}, AuthConf=${context.intelligence.confidence_authority}, ChampConf=${context.intelligence.confidence_champion}`);

      // Detect triggers
      const triggers = await detectTriggers(context);
      results.triggersDetected += triggers.length;

      if (triggers.length === 0) {
        // Log why each trigger type didn't fire
        const now = new Date();
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        const recentActivities = context.recentActivities.filter(a => new Date(a.occurred_at) >= tenDaysAgo);
        const outboundCount = recentActivities.filter(a => a.direction === 'outbound').length;
        const lastInbound = context.recentActivities.filter(a => a.direction === 'inbound')[0];
        const daysSinceInbound = lastInbound
          ? Math.floor((now.getTime() - new Date(lastInbound.occurred_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Check for stalling/dead deals with no activities
        const hasNoActivitiesAndStalling = context.recentActivities.length === 0 &&
          ['stalling', 'dead'].includes(context.intelligence.momentum || '');

        results.debug.push(`Deal ${deal.id} - relationship_repair: daysSinceInbound=${daysSinceInbound}, outbound=${outboundCount}, noActStalling=${hasNoActivitiesAndStalling} (need: 10+ days + 2+ outbound OR noActStalling)`);

        const lowAuth = context.intelligence.confidence_authority < 50;
        const veryLowAuth = context.intelligence.confidence_authority < 30;
        const pastProspecting = !['new_lead', 'prospecting', 'qualifying'].includes(context.deal.stage);
        results.debug.push(`Deal ${deal.id} - exec_intro: authConf=${context.intelligence.confidence_authority}, lowAuth=${lowAuth}, veryLowAuth=${veryLowAuth}, pastProsp=${pastProspecting} (need: low+pastProsp+noDM OR veryLow+pastProsp)`);

        results.debug.push(`Deal ${deal.id} - competitive: competitor=${context.deal.competitor_mentioned || 'none'}, stage=${context.deal.stage} (need: competitor + eval stage)`);
      } else {
        results.debug.push(`Deal ${deal.id}: Found ${triggers.length} triggers: ${triggers.map(t => t.type).join(', ')}`);
      }

      // Process each trigger
      for (const trigger of triggers) {
        // Check stop rules
        const stopCheck = await checkStopRules({
          userId: deal.owner_id,
          dealId: deal.id,
          companyId: deal.company_id,
          triggerType: trigger.type,
          confidence: trigger.confidence,
          expectedValue: context.intelligence.expected_value,
        });

        if (!stopCheck.canCreate) {
          results.momentsBlocked++;
          results.debug.push(`Deal ${deal.id} - ${trigger.type}: BLOCKED by stop rules: ${stopCheck.reason}`);
          continue;
        }

        results.debug.push(`Deal ${deal.id} - ${trigger.type}: Passed stop rules, creating moment...`);

        // Build trust basis and generate brief
        const trustBasis = await buildTrustBasis(trigger);
        const brief = await generateBrief(trigger, context, trustBasis);

        // Create leverage moment
        const { error: createError } = await supabase
          .from('human_leverage_moments')
          .insert({
            company_id: context.companyId,
            deal_id: deal.id,
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
          });

        if (createError) {
          console.error(`[Scan] INSERT ERROR for deal ${deal.id}:`, createError);
          results.errors.push(`Deal ${deal.id}: ${createError.message}`);
          results.debug.push(`Deal ${deal.id} - ${trigger.type}: INSERT FAILED: ${createError.message}`);
          continue;
        }

        results.momentsCreated++;
        results.debug.push(`Deal ${deal.id} - ${trigger.type}: CREATED successfully`);
      }
    } catch (error) {
      console.error(`[Scan] EXCEPTION for deal ${deal.id}:`, error);
      results.errors.push(`Deal ${deal.id}: ${(error as Error).message}`);
    }
  }

  // Final summary - verify moments in DB
  const { count: totalPending } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: totalAll } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true });

  console.log('[Scan] Results:', {
    dealsScanned: results.dealsScanned,
    triggersDetected: results.triggersDetected,
    momentsCreated: results.momentsCreated,
    momentsBlocked: results.momentsBlocked,
    errors: results.errors.length,
    dbTotalPending: totalPending,
    dbTotalAll: totalAll,
  });

  return NextResponse.json({
    message: `Scan complete. Created ${results.momentsCreated} leverage moments.`,
    ...results,
    dbStats: {
      totalPending,
      totalAll,
    },
  });
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

/**
 * Compute intelligence for a deal if it doesn't exist
 */
async function computeIntelligenceForDeal(
  supabase: ReturnType<typeof createAdminClient>,
  dealId: string
) {
  // Fetch deal with related data
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      name,
      stage,
      estimated_value,
      expected_close_date,
      stage_entered_at,
      created_at,
      quoted_products,
      company:companies (
        id,
        name,
        employee_count,
        agent_count
      )
    `)
    .eq('id', dealId)
    .single();

  if (!deal) return null;

  // Extract company (Supabase returns as object for single() but TS infers as array)
  const company = (deal.company as unknown) as { id: string; name: string; employee_count: number | null; agent_count: number | null } | null;

  // Fetch contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, title, role, is_primary')
    .eq('company_id', company?.id);

  // Fetch activities
  const { data: activities } = await supabase
    .from('activities')
    .select('id, type, subject, occurred_at, sentiment')
    .eq('deal_id', dealId)
    .order('occurred_at', { ascending: false })
    .limit(50);

  // Build DealData
  const dealData: DealData = {
    id: deal.id,
    name: deal.name,
    stage: deal.stage,
    amount: null,
    estimated_value: deal.estimated_value,
    close_date: deal.expected_close_date,
    stage_changed_at: deal.stage_entered_at,
    created_at: deal.created_at,
    products: deal.quoted_products,
    company: company
      ? {
          id: company.id,
          name: company.name,
          employee_count: company.employee_count || company.agent_count,
          location_count: null,
          ownership_type: null,
          pct_top_100: false,
        }
      : null,
    contacts: (contacts || []).map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      is_decision_maker: c.role === 'decision_maker',
      is_champion: c.role === 'champion',
    })),
    activities: (activities || []).map((a) => ({
      id: a.id,
      type: a.type,
      direction: inferActivityDirection(a.type),
      date: a.occurred_at,
      subject: a.subject,
    })),
  };

  // Compute intelligence
  const intelligence = computeDealIntelligence(dealData);

  // Save to database
  await supabase.from('deal_intelligence').upsert(
    {
      ...intelligence,
      deal_id: dealId,
      momentum_signals: intelligence.momentum_signals,
      probability_factors: intelligence.probability_factors,
      risk_factors: intelligence.risk_factors,
      stall_reasons: intelligence.stall_reasons,
      next_actions: intelligence.next_actions,
    },
    { onConflict: 'deal_id' }
  );

  return intelligence;
}

function inferActivityDirection(activityType: string): 'inbound' | 'outbound' | null {
  switch (activityType) {
    case 'email_received':
      return 'inbound';
    case 'email_sent':
    case 'call_made':
    case 'proposal_sent':
      return 'outbound';
    default:
      return null;
  }
}
