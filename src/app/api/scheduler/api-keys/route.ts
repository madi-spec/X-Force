import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys, createApiKey } from '@/lib/scheduler/apiKeyService';

export const dynamic = 'force-dynamic';

// GET - List all API keys
export async function GET() {
  try {
    const keys = await getApiKeys();

    // Never return the key_hash for security
    const sanitizedKeys = keys.map((key) => ({
      ...key,
      key_hash: undefined,
    }));

    return NextResponse.json(sanitizedKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      permissions,
      allowed_ips,
      rate_limit_per_minute,
      rate_limit_per_day,
      expires_at,
    } = body;

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const keyWithSecret = await createApiKey({
      name,
      description,
      permissions,
      allowed_ips,
      rate_limit_per_minute,
      rate_limit_per_day,
      expires_at,
    });

    // Return the key - this is the only time the secret will be visible
    return NextResponse.json(
      {
        ...keyWithSecret,
        key_hash: undefined,
        message:
          'Save this API key securely. You will not be able to see it again.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
