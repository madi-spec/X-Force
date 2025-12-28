/**
 * Social Proof Library Admin API
 *
 * GET - List social proof entries from library
 * POST - Create new entry
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSocialProofLibrary,
  createSocialProofEntry,
} from '@/lib/scheduler/settingsService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const proof_type = searchParams.get('type') || undefined;
    const is_active = searchParams.get('active');
    const target_industry = searchParams.get('industry') || undefined;

    const entries = await getSocialProofLibrary({
      proof_type,
      is_active: is_active === null ? undefined : is_active === 'true',
      target_industry,
    });

    return NextResponse.json({ data: entries });
  } catch (err) {
    console.error('[SocialProof Admin API] GET Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch social proof library' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { proof_type, title, content } = body;

    if (!proof_type || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: proof_type, title, content' },
        { status: 400 }
      );
    }

    const entry = await createSocialProofEntry(body);

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (err) {
    console.error('[SocialProof Admin API] POST Error:', err);
    return NextResponse.json(
      { error: 'Failed to create social proof entry' },
      { status: 500 }
    );
  }
}
