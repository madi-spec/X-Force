import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getPendingDrafts, generateDraftResponse, updateDraftStatus } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// GET - Get pending drafts
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile user_id (email tables use this, not auth user id)
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const drafts = await getPendingDrafts(profile.id);

    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}

// POST - Generate or update draft
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, conversationId, draftId, status, sentMessageId } = body;

    if (action === 'generate') {
      if (!conversationId) {
        return NextResponse.json(
          { error: 'conversationId required' },
          { status: 400 }
        );
      }

      const result = await generateDraftResponse(conversationId, 'manual');

      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json(result.draft, { status: 201 });
    }

    if (action === 'update') {
      if (!draftId || !status) {
        return NextResponse.json(
          { error: 'draftId and status required' },
          { status: 400 }
        );
      }

      await updateDraftStatus(draftId, status, sentMessageId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error with drafts:', error);
    return NextResponse.json(
      { error: 'Failed to process draft' },
      { status: 500 }
    );
  }
}
