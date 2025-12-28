import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSchedulingFromConversation,
  linkConversationToScheduling,
  getSchedulingSuggestions,
} from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// GET - Get scheduling suggestions for a conversation
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId required' },
        { status: 400 }
      );
    }

    // Verify user owns this conversation
    const { data: conversation } = await supabase
      .from('email_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', profile.id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const suggestions = await getSchedulingSuggestions(conversationId);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error getting scheduling suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduling suggestions' },
      { status: 500 }
    );
  }
}

// POST - Create scheduling request from conversation or link to existing
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action, conversationId, schedulingRequestId, options } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId required' },
        { status: 400 }
      );
    }

    // Verify user owns this conversation
    const { data: conversation } = await supabase
      .from('email_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', profile.id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (action === 'create') {
      // Create a new scheduling request from the conversation
      const result = await createSchedulingFromConversation(
        conversationId,
        profile.id,
        options
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create scheduling request' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: true, requestId: result.requestId },
        { status: 201 }
      );
    }

    if (action === 'link') {
      // Link conversation to existing scheduling request
      if (!schedulingRequestId) {
        return NextResponse.json(
          { error: 'schedulingRequestId required for link action' },
          { status: 400 }
        );
      }

      const result = await linkConversationToScheduling(
        conversationId,
        schedulingRequestId
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to link conversation' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error with scheduling:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduling request' },
      { status: 500 }
    );
  }
}
