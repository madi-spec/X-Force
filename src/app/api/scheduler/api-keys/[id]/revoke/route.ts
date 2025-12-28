import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/scheduler/apiKeyService';

export const dynamic = 'force-dynamic';

// POST - Revoke API key
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    await revokeApiKey(id, reason);

    return NextResponse.json({
      success: true,
      message: 'API key has been revoked',
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
