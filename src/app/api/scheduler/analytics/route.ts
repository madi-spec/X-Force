/**
 * Scheduling Analytics API
 *
 * GET - Get comprehensive scheduling analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalyticsSummary,
  getSchedulingFunnel,
  getChannelMetrics,
  getTimeSlotMetrics,
  getMeetingTypeMetrics,
  getRepMetrics,
  getSocialProofMetrics,
  getSeasonalMetrics,
} from '@/lib/scheduler';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const metric = searchParams.get('metric'); // Optional: specific metric to fetch

    // Build date range
    let dateRange: { start: Date; end: Date } | undefined;
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    // If specific metric requested, return only that
    if (metric) {
      let data;
      switch (metric) {
        case 'funnel':
          data = await getSchedulingFunnel(dateRange);
          break;
        case 'channels':
          data = await getChannelMetrics(dateRange);
          break;
        case 'time_slots':
          data = await getTimeSlotMetrics(dateRange);
          break;
        case 'meeting_types':
          data = await getMeetingTypeMetrics(dateRange);
          break;
        case 'reps':
          data = await getRepMetrics(dateRange);
          break;
        case 'social_proof':
          data = await getSocialProofMetrics();
          break;
        case 'seasonal':
          data = await getSeasonalMetrics();
          break;
        default:
          return NextResponse.json(
            { error: `Unknown metric: ${metric}` },
            { status: 400 }
          );
      }
      return NextResponse.json({ data });
    }

    // Return full analytics summary
    const summary = await getAnalyticsSummary(dateRange);

    return NextResponse.json({ data: summary });
  } catch (err) {
    console.error('[Analytics API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
