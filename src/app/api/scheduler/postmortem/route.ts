/**
 * Scheduling Postmortem API
 *
 * POST - Create postmortem for a completed scheduling request
 * GET - Get scheduling performance report
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSchedulingPostmortem,
  getSchedulingPerformanceReport,
} from '@/lib/scheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduling_request_id } = body;

    if (!scheduling_request_id) {
      return NextResponse.json(
        { error: 'scheduling_request_id is required' },
        { status: 400 }
      );
    }

    const result = await createSchedulingPostmortem(scheduling_request_id);

    return NextResponse.json({
      data: result,
      message: 'Postmortem created successfully',
    });
  } catch (err) {
    console.error('[Postmortem API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create postmortem' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    let dateRange: { start: Date; end: Date } | undefined;
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    const report = await getSchedulingPerformanceReport(dateRange);

    return NextResponse.json({ data: report });
  } catch (err) {
    console.error('[Postmortem API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to get performance report' },
      { status: 500 }
    );
  }
}
