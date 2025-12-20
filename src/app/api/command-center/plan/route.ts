/**
 * Daily Plan API
 *
 * GET - Get or generate daily plan for a specific date
 * POST - Regenerate plan (after calendar change or manual refresh)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  getDailyPlan,
  generateDailyPlan,
  calculateDailyCapacity,
  getRepTimeProfile,
} from '@/lib/commandCenter';

// Helper to get internal user ID from auth user
async function getInternalUserId(authUserId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUserId)
    .single();
  return dbUser?.id || null;
}

// ============================================
// GET - Get daily plan
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

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get date from query params (default to today)
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    let planDate: Date;
    if (dateParam) {
      planDate = new Date(dateParam);
      if (isNaN(planDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
    } else {
      planDate = new Date();
    }

    // Check if auto-generate is requested
    const autoGenerate = searchParams.get('auto_generate') !== 'false';

    // Try to get existing plan
    let plan = await getDailyPlan(userId, planDate);

    // Generate if not exists and auto-generate enabled
    if (!plan && autoGenerate) {
      plan = await generateDailyPlan(userId, planDate);
    }

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'No plan exists for this date' },
        { status: 404 }
      );
    }

    // Get capacity for context
    const capacity = await calculateDailyCapacity(userId, planDate);

    return NextResponse.json({
      success: true,
      plan,
      capacity,
      date: planDate.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('[CommandCenter/Plan] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST - Regenerate plan
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

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const dateParam = body.date;

    let planDate: Date;
    if (dateParam) {
      planDate = new Date(dateParam);
      if (isNaN(planDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
    } else {
      planDate = new Date();
    }

    // Get profile for context
    const profile = await getRepTimeProfile(userId);

    // Regenerate plan
    const plan = await generateDailyPlan(userId, planDate);

    // Get fresh capacity
    const capacity = await calculateDailyCapacity(userId, planDate);

    return NextResponse.json({
      success: true,
      plan,
      capacity,
      profile: {
        work_start_time: profile.work_start_time,
        work_end_time: profile.work_end_time,
        work_days: profile.work_days,
        timezone: profile.timezone,
      },
      regenerated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CommandCenter/Plan] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
