import { createClient } from '@/lib/supabase/server';
import { ReportsDashboard } from '@/components/reports/ReportsDashboard';

interface DealStats {
  total_deals: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  total_pipeline: number;
  won_value: number;
}

interface CustomerStats {
  total: number;
  active: number;
  churned: number;
  total_mrr: number;
}

interface RecentDeal {
  id: string;
  title: string;
  value: number | null;
  stage: string;
  closed_at: string | null;
  company: { id: string; name: string } | null;
}

const defaultDealStats: DealStats = {
  total_deals: 0,
  open_deals: 0,
  won_deals: 0,
  lost_deals: 0,
  total_pipeline: 0,
  won_value: 0,
};

const defaultCustomerStats: CustomerStats = {
  total: 0,
  active: 0,
  churned: 0,
  total_mrr: 0,
};

export default async function ReportsPage() {
  const supabase = await createClient();

  // Fetch recent closed deals
  const { data: recentDealsRaw } = await supabase
    .from('deals')
    .select(`
      id,
      title,
      value,
      stage,
      closed_at,
      company:companies(id, name)
    `)
    .in('stage', ['closed_won', 'closed_lost'])
    .gte('closed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('closed_at', { ascending: false })
    .limit(10);

  // Transform deals to fix company relation (returns array)
  const recentDeals: RecentDeal[] = (recentDealsRaw || []).map((deal) => ({
    ...deal,
    company: Array.isArray(deal.company) ? deal.company[0] || null : deal.company,
  })) as RecentDeal[];

  // Fetch pipeline by stage
  const { data: pipelineByStage } = await supabase
    .from('deals')
    .select('stage, value')
    .not('stage', 'in', '("closed_won","closed_lost")');

  // Calculate pipeline by stage
  const stageMap: Record<string, { count: number; value: number }> = {};
  (pipelineByStage || []).forEach((deal) => {
    if (!stageMap[deal.stage]) {
      stageMap[deal.stage] = { count: 0, value: 0 };
    }
    stageMap[deal.stage].count++;
    stageMap[deal.stage].value += deal.value || 0;
  });

  const pipelineSummary = Object.entries(stageMap).map(([stage, data]) => ({
    stage,
    count: data.count,
    value: data.value,
  }));

  // Try to fetch stats from RPC, fallback to computed values
  let dealStats: DealStats = defaultDealStats;
  let customerStats: CustomerStats = defaultCustomerStats;

  try {
    const { data: dealStatsData } = await supabase.rpc('get_deal_stats').single();
    if (dealStatsData && typeof dealStatsData === 'object' && 'total_deals' in (dealStatsData as Record<string, unknown>)) {
      dealStats = dealStatsData as DealStats;
    }
  } catch {
    // RPC may not exist, compute from pipeline data
    const totalPipeline = pipelineSummary.reduce((sum, s) => sum + s.value, 0);
    const openDeals = pipelineSummary.reduce((sum, s) => sum + s.count, 0);
    const wonDeals = recentDeals.filter((d) => d.stage === 'closed_won').length;
    const lostDeals = recentDeals.filter((d) => d.stage === 'closed_lost').length;
    const wonValue = recentDeals
      .filter((d) => d.stage === 'closed_won')
      .reduce((sum, d) => sum + (d.value || 0), 0);

    dealStats = {
      total_deals: openDeals + wonDeals + lostDeals,
      open_deals: openDeals,
      won_deals: wonDeals,
      lost_deals: lostDeals,
      total_pipeline: totalPipeline,
      won_value: wonValue,
    };
  }

  try {
    const { data: customerStatsData } = await supabase.rpc('get_customer_stats').single();
    if (customerStatsData && typeof customerStatsData === 'object' && 'total' in (customerStatsData as Record<string, unknown>)) {
      customerStats = customerStatsData as CustomerStats;
    }
  } catch {
    // RPC may not exist, use defaults
  }

  return (
    <ReportsDashboard
      dealStats={dealStats}
      customerStats={customerStats}
      recentDeals={recentDeals}
      pipelineSummary={pipelineSummary}
    />
  );
}
