import { NextRequest, NextResponse } from 'next/server';
import { testWebhook } from '@/lib/scheduler/webhookService';

export const dynamic = 'force-dynamic';

// POST - Test webhook delivery
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Send test webhook - testWebhook already handles fetching and verification
    const result = await testWebhook(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}
