/**
 * Check for Scheduling Leverage Moments
 *
 * POST - Run leverage moment detection on all active scheduling requests
 */

import { NextResponse } from 'next/server';
import { checkAllSchedulingLeverageMoments } from '@/lib/scheduler';

export async function POST() {
  try {
    const result = await checkAllSchedulingLeverageMoments();

    return NextResponse.json({
      data: result,
      message: `Checked ${result.checked} requests, created ${result.moments_created} moments`,
    });
  } catch (err) {
    console.error('[LeverageMoments Check API] Error:', err);
    return NextResponse.json({ error: 'Failed to check leverage moments' }, { status: 500 });
  }
}
