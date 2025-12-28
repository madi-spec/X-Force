/**
 * No-Show Detection API
 *
 * POST - Detect and process no-shows
 */

import { NextResponse } from 'next/server';
import { processAllNoShows } from '@/lib/scheduler';

export async function POST() {
  try {
    const result = await processAllNoShows();

    return NextResponse.json({
      data: {
        detected: result.detected,
        processed: result.processed,
      },
      message: `Detected ${result.detected} no-shows, processed ${result.processed}`,
    });
  } catch (err) {
    console.error('[NoShows API] Error:', err);
    return NextResponse.json({ error: 'Failed to process no-shows' }, { status: 500 });
  }
}
