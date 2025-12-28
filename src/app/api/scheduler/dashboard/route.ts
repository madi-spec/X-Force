import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SchedulingService } from '@/lib/scheduler/schedulingService';

/**
 * GET /api/scheduler/dashboard
 * Get dashboard data for the scheduler
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedulingService = new SchedulingService();
    const { data, error } = await schedulingService.getDashboardData();

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });

  } catch (err) {
    console.error('Error fetching scheduler dashboard:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
