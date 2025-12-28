/**
 * Seasonality Context API
 *
 * GET - Get current seasonal context and recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSeasonalContext,
  getSeasonalityReport,
  getOptimalSchedulingWindow,
} from '@/lib/scheduler';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state') || undefined;
    const includeReport = searchParams.get('report') === 'true';
    const includeWindow = searchParams.get('window') === 'true';
    const meetingDuration = parseInt(searchParams.get('duration') || '30');

    // Get current seasonal context
    const context = await getSeasonalContext(state);

    const response: {
      context: typeof context;
      report?: Awaited<ReturnType<typeof getSeasonalityReport>>;
      schedulingWindow?: Awaited<ReturnType<typeof getOptimalSchedulingWindow>>;
    } = { context };

    // Optionally include full year report
    if (includeReport) {
      response.report = await getSeasonalityReport();
    }

    // Optionally include optimal scheduling window
    if (includeWindow) {
      response.schedulingWindow = await getOptimalSchedulingWindow(
        state,
        meetingDuration
      );
    }

    return NextResponse.json({ data: response });
  } catch (err) {
    console.error('[Seasonality API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to get seasonal context' },
      { status: 500 }
    );
  }
}
