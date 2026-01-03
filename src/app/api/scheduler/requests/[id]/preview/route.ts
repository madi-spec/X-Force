import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDraft, regenerateDraft } from '@/lib/scheduler/draftService';
import type { EmailType } from '@/lib/scheduler/emailGeneration';

/**
 * GET /api/scheduler/requests/[id]/preview
 *
 * Get or generate a preview draft for a scheduling request.
 * If a pending draft exists, returns it (preserving times).
 * If not, generates a new draft and saves it to the database.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const emailType = (searchParams.get('type') || 'initial_outreach') as EmailType;

    // Generate or retrieve existing draft
    const result = await generateDraft(id, userData.id, emailType);

    return NextResponse.json({
      draft: result.draft,
      warnings: result.warnings,
      isExisting: result.isExisting,
    });
  } catch (err) {
    console.error('Error in scheduler preview endpoint:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scheduler/requests/[id]/preview
 *
 * Force regenerate a draft (user explicitly wants new times).
 * This clears the existing draft and generates a fresh one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Parse request body for email type
    let body: { emailType?: EmailType } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is ok
    }

    const emailType = body.emailType || 'initial_outreach';

    // Force regenerate draft
    const result = await regenerateDraft(id, userData.id, emailType);

    return NextResponse.json({
      draft: result.draft,
      warnings: result.warnings,
      isExisting: false,
    });
  } catch (err) {
    console.error('Error in scheduler regenerate preview endpoint:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
