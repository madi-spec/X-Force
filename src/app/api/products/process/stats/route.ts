import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType } from '@/types/products';

function computeNeedsAttention(
  lastActivityAt: string | null,
  lastHumanTouchAt: string | null,
  lastStageMoved: string | null,
  stageEnteredAt: string | null,
  createdAt: string
): boolean {
  const now = new Date();
  const activityDate = lastActivityAt || lastHumanTouchAt || createdAt;
  const stageDate = lastStageMoved || stageEnteredAt || createdAt;

  const daysSinceActivity = Math.floor((now.getTime() - new Date(activityDate).getTime()) / (1000 * 60 * 60 * 24));
  const daysInStage = Math.floor((now.getTime() - new Date(stageDate).getTime()) / (1000 * 60 * 60 * 24));

  return daysSinceActivity > 14 || daysInStage >= 30;
}

export async function GET() {
  const supabase = await createClient();

  try {
    const processes: ProcessType[] = ['sales', 'onboarding', 'customer_service', 'engagement'];
    const statusMap: Record<ProcessType, string[]> = {
      sales: ['in_sales'],
      onboarding: ['in_onboarding'],
      customer_service: ['active'],
      engagement: ['active'],
    };

    const results = [];

    for (const process of processes) {
      const { data } = await supabase
        .from('company_products')
        .select('last_activity_at, last_human_touch_at, last_stage_moved_at, stage_entered_at, created_at')
        .in('status', statusMap[process]);

      const items = data || [];
      const needsAttentionCount = items.filter(item =>
        computeNeedsAttention(
          item.last_activity_at,
          item.last_human_touch_at,
          item.last_stage_moved_at,
          item.stage_entered_at,
          item.created_at
        )
      ).length;

      results.push({
        process,
        total: items.length,
        needsAttention: needsAttentionCount,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Process stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch process stats' }, { status: 500 });
  }
}
