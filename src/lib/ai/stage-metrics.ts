import { createClient } from '@/lib/supabase/server';

interface StageMetrics {
  stage_id: string;
  stage_name: string;
  companies_in_stage: number;
  avg_days_in_stage: number;
  conversion_rate: number;
  companies_won: number;
  companies_lost: number;
}

interface Stage {
  id: string;
  name: string;
  stage_order: number;
}

interface CompanyProduct {
  id: string;
  status: string;
  current_stage_id: string;
  stage_entered_at: string | null;
}

interface HistoryRecord {
  id: string;
  company_product_id: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export async function calculateStageMetrics(
  productId: string
): Promise<StageMetrics[]> {
  const supabase = await createClient();

  // Get sales process for this product
  const { data: salesProcess } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', productId)
    .eq('process_type', 'sales')
    .eq('status', 'published')
    .single();

  if (!salesProcess) return [];

  // Get all stages from unified table
  const { data: stages } = await supabase
    .from('product_process_stages')
    .select('id, name, stage_order')
    .eq('process_id', salesProcess.id)
    .order('stage_order');

  if (!stages) return [];

  // Get all company_products for this product
  const { data: companyProducts } = await supabase
    .from('company_products')
    .select('id, status, current_stage_id, stage_entered_at')
    .eq('product_id', productId);

  // Get history for calculating avg days
  const { data: history } = await supabase
    .from('company_product_history')
    .select('*')
    .in('company_product_id', (companyProducts || []).map(cp => cp.id))
    .eq('event_type', 'stage_changed')
    .order('created_at');

  // Calculate metrics per stage
  const metrics: StageMetrics[] = [];

  for (let i = 0; i < (stages as Stage[]).length; i++) {
    const stage = (stages as Stage[])[i];
    const nextStage = (stages as Stage[])[i + 1];

    // Count currently in stage
    const inStage = ((companyProducts as CompanyProduct[]) || []).filter(
      cp => cp.current_stage_id === stage.id && cp.status === 'in_sales'
    ).length;

    // Find stage transitions
    const transitionsFrom = ((history as HistoryRecord[]) || []).filter(h => h.from_value === stage.id);
    const transitionsTo = ((history as HistoryRecord[]) || []).filter(h => h.to_value === stage.id);

    // Calculate avg days (simplified)
    let totalDays = 0;
    let daysCount = 0;

    for (const t of transitionsFrom) {
      const entryRecord = transitionsTo.find(
        e => e.company_product_id === t.company_product_id &&
          new Date(e.created_at) < new Date(t.created_at)
      );
      if (entryRecord) {
        const days = Math.floor(
          (new Date(t.created_at).getTime() - new Date(entryRecord.created_at).getTime())
          / (1000 * 60 * 60 * 24)
        );
        totalDays += days;
        daysCount++;
      }
    }

    // Calculate conversion rate
    const movedToNext = nextStage
      ? transitionsFrom.filter(t => t.to_value === nextStage.id).length
      : 0;

    const won = ((companyProducts as CompanyProduct[]) || []).filter(
      cp => cp.status === 'active'
    ).length;

    const lost = ((companyProducts as CompanyProduct[]) || []).filter(
      cp => cp.status === 'declined'
    ).length;

    const totalExitedStage = transitionsFrom.length;
    const conversionRate = totalExitedStage > 0
      ? movedToNext / totalExitedStage
      : 0;

    metrics.push({
      stage_id: stage.id,
      stage_name: stage.name,
      companies_in_stage: inStage,
      avg_days_in_stage: daysCount > 0 ? Math.round(totalDays / daysCount) : 0,
      conversion_rate: Math.round(conversionRate * 100),
      companies_won: won,
      companies_lost: lost
    });
  }

  return metrics;
}

export async function updateStageMetrics(productId: string): Promise<void> {
  const supabase = await createClient();
  const metrics = await calculateStageMetrics(productId);

  for (const m of metrics) {
    await supabase
      .from('product_process_stages')
      .update({
        avg_days_in_stage: m.avg_days_in_stage,
        conversion_rate: m.conversion_rate
      })
      .eq('id', m.stage_id);
  }
}
