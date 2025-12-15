import { NextRequest, NextResponse } from 'next/server';
import {
  detectAllSignals,
  detectDealSignals,
  saveSignals,
  getActiveSignals,
} from '@/lib/ai/signals/signalDetector';
import type { SignalCategory, SignalSeverity } from '@/lib/ai/signals/signalDetector';

/**
 * GET /api/ai/signals
 * Fetch active signals with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dealId = searchParams.get('dealId') || undefined;
    const category = searchParams.get('category') as SignalCategory | undefined;
    const severity = searchParams.get('severity') as SignalSeverity | undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;

    const signals = await getActiveSignals({
      dealId,
      category,
      severity,
      limit,
    });

    return NextResponse.json({
      signals,
      count: signals.length,
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/signals
 * Run signal detection for one or all deals
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dealId, save = true } = body;

    let signals;

    if (dealId) {
      // Detect signals for a single deal
      signals = await detectDealSignals(dealId);
    } else {
      // Detect signals for all open deals
      signals = await detectAllSignals();
    }

    // Optionally save signals to database
    if (save && signals.length > 0) {
      await saveSignals(signals);
    }

    return NextResponse.json({
      signals,
      count: signals.length,
      saved: save,
    });
  } catch (error) {
    console.error('Error detecting signals:', error);
    return NextResponse.json(
      { error: 'Failed to detect signals' },
      { status: 500 }
    );
  }
}
