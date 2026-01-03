import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDraft, updateDraft } from '@/lib/scheduler/draftService';

/**
 * GET /api/scheduler/requests/[id]/draft
 *
 * Get the current draft for a scheduling request.
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

    const draft = await getDraft(id);

    if (!draft) {
      return NextResponse.json(
        { error: 'No draft found. Please generate a preview first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ draft });
  } catch (err) {
    console.error('Error in get draft endpoint:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scheduler/requests/[id]/draft
 *
 * Update draft content (subject and/or body).
 * Used when user edits the email in the preview modal.
 * Proposed times are NOT updated - they remain locked.
 */
export async function PATCH(
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

    // Parse request body
    const body = await request.json();
    const { subject, body: emailBody } = body;

    if (!subject && !emailBody) {
      return NextResponse.json(
        { error: 'Must provide subject or body to update' },
        { status: 400 }
      );
    }

    const updatedDraft = await updateDraft(id, {
      subject,
      body: emailBody,
    });

    return NextResponse.json({ draft: updatedDraft });
  } catch (err) {
    console.error('Error in update draft endpoint:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
