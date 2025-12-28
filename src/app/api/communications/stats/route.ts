import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CommunicationAnalysis {
  products_discussed: string[] | null;
  extracted_signals: Array<{ signal: string }> | null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const companyId = searchParams.get('company_id');

  if (!companyId) {
    return NextResponse.json({ error: 'company_id required' }, { status: 400 });
  }

  // Get communications for this company
  const { data: comms, error } = await supabase
    .from('communications')
    .select(`
      id,
      channel,
      direction,
      occurred_at,
      current_analysis:communication_analysis!current_analysis_id(
        products_discussed,
        extracted_signals
      )
    `)
    .eq('company_id', companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate stats
  const total = comms?.length || 0;
  const inbound = comms?.filter(c => c.direction === 'inbound').length || 0;
  const outbound = comms?.filter(c => c.direction === 'outbound').length || 0;

  // Collect all products discussed
  const productsSet = new Set<string>();
  const signalsArr: Array<{ signal: string }> = [];

  for (const comm of comms || []) {
    // Supabase returns joined relations - handle both array and object cases
    const analysisRaw = comm.current_analysis as unknown;
    const analysis = (Array.isArray(analysisRaw) ? analysisRaw[0] : analysisRaw) as CommunicationAnalysis | null;
    if (analysis?.products_discussed) {
      analysis.products_discussed.forEach((p) => productsSet.add(p));
    }
    if (analysis?.extracted_signals) {
      signalsArr.push(...analysis.extracted_signals);
    }
  }

  // Get recent signals (last 5 unique)
  const recentSignals = signalsArr
    .slice(0, 10)
    .reduce((acc: Array<{ signal: string; type: string }>, signal) => {
      if (!acc.find(s => s.signal === signal.signal)) {
        acc.push({
          signal: signal.signal,
          type: signal.signal.includes('risk') || signal.signal.includes('concern')
            ? 'negative'
            : 'positive',
        });
      }
      return acc;
    }, [])
    .slice(0, 5);

  return NextResponse.json({
    stats: {
      total_communications: total,
      inbound,
      outbound,
      products_discussed: Array.from(productsSet),
      recent_signals: recentSignals,
      avg_response_time: '2h', // Would calculate from actual data
    },
  });
}
