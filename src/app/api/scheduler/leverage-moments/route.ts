/**
 * Scheduling Leverage Moments API
 *
 * GET - Fetch pending leverage moments for scheduling
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Get pending scheduling leverage moments
    const { data: moments, error } = await supabase
      .from('human_leverage_moments')
      .select(`
        id,
        type,
        urgency,
        company_id,
        deal_id,
        situation,
        what_human_must_do,
        status,
        created_at,
        trigger_data
      `)
      .like('type', 'scheduling_%')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[LeverageMoments API] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch moments' }, { status: 500 });
    }

    // Get company names
    const companyIds = [...new Set(moments?.map(m => m.company_id).filter(Boolean))];
    let companyMap: Record<string, string> = {};

    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      if (companies) {
        companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));
      }
    }

    // Enrich moments with company names
    const enrichedMoments = moments?.map(m => ({
      ...m,
      company_name: m.company_id ? companyMap[m.company_id] : null,
    }));

    return NextResponse.json({ data: enrichedMoments });
  } catch (err) {
    console.error('[LeverageMoments API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
