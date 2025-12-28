/**
 * Seasonality Overrides Admin API
 *
 * GET - List seasonality overrides
 * POST - Create new override
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSeasonalityOverrides,
  createSeasonalityOverride,
  getActiveSeasonality,
} from '@/lib/scheduler/settingsService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const is_active = searchParams.get('active');
    const from_date = searchParams.get('from') || undefined;
    const to_date = searchParams.get('to') || undefined;
    const forDate = searchParams.get('forDate');

    // If checking for a specific date, use the active seasonality function
    if (forDate) {
      const active = await getActiveSeasonality(forDate);
      return NextResponse.json({ data: active });
    }

    const overrides = await getSeasonalityOverrides({
      is_active: is_active === null ? undefined : is_active === 'true',
      from_date,
      to_date,
    });

    return NextResponse.json({ data: overrides });
  } catch (err) {
    console.error('[Seasonality Admin API] GET Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch seasonality overrides' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { start_date, end_date, override_type, name } = body;

    if (!start_date || !end_date || !override_type || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: start_date, end_date, override_type, name' },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { error: 'end_date must be after start_date' },
        { status: 400 }
      );
    }

    const override = await createSeasonalityOverride(body);

    return NextResponse.json({ data: override }, { status: 201 });
  } catch (err) {
    console.error('[Seasonality Admin API] POST Error:', err);
    return NextResponse.json(
      { error: 'Failed to create seasonality override' },
      { status: 500 }
    );
  }
}
