import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getConversations, getActionQueueCounts, type ConversationStatus, type EmailConversation } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// GET - List conversations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile user_id (email_conversations uses this, not auth user id)
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority') as 'high' | 'medium' | 'low' | null;
    const dealId = searchParams.get('dealId');
    const companyId = searchParams.get('companyId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const view = searchParams.get('view'); // 'queue' for action queue counts

    // If requesting action queue counts
    if (view === 'queue') {
      const counts = await getActionQueueCounts(profile.id);
      return NextResponse.json(counts);
    }

    // Parse status filter
    let statusFilter: ConversationStatus | ConversationStatus[] | undefined;
    if (status) {
      if (status === 'needs_action') {
        statusFilter = ['pending', 'awaiting_response'] as ConversationStatus[];
      } else {
        statusFilter = status as ConversationStatus;
      }
    }

    const result = await getConversations(profile.id, {
      status: statusFilter,
      priority: priority || undefined,
      dealId: dealId || undefined,
      companyId: companyId || undefined,
      limit,
      offset,
    });

    // Transform conversations to match UI expected format
    const transformedConversations = (result.conversations || []).map((conv: EmailConversation) => ({
      id: conv.id,
      user_id: profile.id,
      thread_id: conv.conversation_id,
      subject: conv.subject,
      participants: (conv.participant_emails || []).map((email: string, i: number) => ({
        address: email,
        name: conv.participant_names?.[i] || undefined,
      })),
      last_message_at: conv.last_message_at,
      last_external_at: conv.last_inbound_at,
      message_count: conv.message_count || 0,
      status: conv.status || 'pending',
      priority: conv.ai_priority,
      action_queue: conv.status === 'pending' && conv.ai_priority === 'high'
        ? 'respond'
        : conv.status === 'awaiting_response'
          ? 'follow_up'
          : conv.status === 'pending'
            ? 'review'
            : 'fyi',
      snoozed_until: conv.snoozed_until,
      snooze_reason: conv.snooze_reason,
      deal_id: conv.deal_id,
      company_id: conv.company_id,
      contact_id: conv.contact_id,
      link_confidence: conv.link_confidence,
      sla_deadline: conv.response_due_at,
      sla_status: conv.sla_status,
      ai_summary: conv.ai_thread_summary,
      ai_signals: conv.signals ? Object.keys(conv.signals as Record<string, boolean>).filter(k => (conv.signals as Record<string, boolean>)[k]) : [],
      has_pending_draft: conv.has_pending_draft,
      created_at: conv.last_message_at,
      updated_at: conv.last_message_at,
    }));

    return NextResponse.json({ conversations: transformedConversations, total: result.total });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
