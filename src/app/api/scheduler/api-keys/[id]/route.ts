import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
} from '@/lib/scheduler/apiKeyService';

export const dynamic = 'force-dynamic';

// GET - Get single API key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const key = await getApiKey(id);

    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Never return the key_hash
    return NextResponse.json({
      ...key,
      key_hash: undefined,
    });
  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key' },
      { status: 500 }
    );
  }
}

// PUT - Update API key
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Don't allow updating sensitive fields
    const {
      key_hash: _hash,
      key_prefix: _prefix,
      secret_key: _secret,
      ...updates
    } = body;

    const key = await updateApiKey(id, updates);

    return NextResponse.json({
      ...key,
      key_hash: undefined,
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

// DELETE - Delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteApiKey(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}
