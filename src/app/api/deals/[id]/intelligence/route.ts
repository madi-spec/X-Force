import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeDealIntelligence, DealData, DealIntelligence } from '@/lib/ai/intelligence';

/**
 * GET /api/deals/[id]/intelligence
 *
 * Computes deal intelligence for a specific deal.
 * Returns momentum, confidence factors, win probability, economics, and recommended actions.
 *
 * Query params:
 * - refresh: boolean - force recomputation even if cached
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Authenticate
  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    // Check for cached intelligence (less than 1 hour old)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('deal_intelligence')
        .select('*')
        .eq('deal_id', id)
        .single();

      if (cached) {
        const computedAt = new Date(cached.computed_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        if (computedAt > oneHourAgo) {
          return NextResponse.json({
            intelligence: cached,
            cached: true,
          });
        }
      }
    }

    // Fetch deal with related data
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(
        `
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
          agent_count,
          segment,
          voice_customer
        )
      `
      )
      .eq('id', id)
      .single();

    if (dealError || !deal) {
      console.error('[Deal Intelligence] Deal not found:', dealError);
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Fetch contacts for the company
    const company = Array.isArray(deal.company) ? deal.company[0] : deal.company;
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, title, role, is_primary')
      .eq('company_id', company?.id);

    // Fetch activities for the deal
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, subject, occurred_at, sentiment')
      .eq('deal_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50);

    // Transform to DealData format
    const dealData: DealData = {
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      amount: null, // We don't have a separate amount field
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
            location_count: null, // Not tracked in current schema
            ownership_type: null, // Not tracked in current schema
            pct_top_100: false, // Not tracked in current schema
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
        direction: inferDirection(a.type),
        date: a.occurred_at,
        subject: a.subject,
      })),
    };

    // Compute intelligence
    const intelligence = computeDealIntelligence(dealData);

    // Save to database
    const { error: saveError } = await supabase.from('deal_intelligence').upsert(
      {
        ...intelligence,
        // Ensure deal_id is set (in case it's missing from intelligence)
        deal_id: intelligence.deal_id || id,
      },
      {
        onConflict: 'deal_id',
      }
    );

    if (saveError) {
      console.error('[Deal Intelligence] Failed to save:', saveError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      intelligence,
      cached: false,
    });
  } catch (error) {
    console.error('[Deal Intelligence] Error:', error);
    return NextResponse.json({ error: 'Failed to compute intelligence' }, { status: 500 });
  }
}

/**
 * Infer activity direction from type
 */
function inferDirection(activityType: string): 'inbound' | 'outbound' | null {
  switch (activityType) {
    case 'email_received':
      return 'inbound';
    case 'email_sent':
    case 'call_made':
    case 'proposal_sent':
      return 'outbound';
    case 'meeting_held':
      return null; // Meetings are bidirectional
    default:
      return null;
  }
}
