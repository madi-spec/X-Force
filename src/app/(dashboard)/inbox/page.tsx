import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InboxView } from '@/components/inbox';

export default async function InboxPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Check if user has conversation-based inbox (has email_conversations)
  const { data: conversations } = await supabase
    .from('email_conversations')
    .select(`
      id,
      conversation_id,
      subject,
      participant_emails,
      participant_names,
      last_message_at,
      last_inbound_at,
      message_count,
      status,
      ai_priority,
      snoozed_until,
      snooze_reason,
      deal_id,
      company_id,
      contact_id,
      link_confidence,
      response_due_at,
      sla_status,
      ai_thread_summary,
      signals,
      has_pending_draft,
      deal:deals(id, name, stage),
      company:companies(id, name),
      contact:contacts(id, name, email)
    `)
    .eq('user_id', profile.id)
    .order('last_message_at', { ascending: false })
    .limit(100);

  // Get action queue counts
  const { count: respondCount } = await supabase
    .from('email_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .eq('ai_priority', 'high');

  const { count: followUpCount } = await supabase
    .from('email_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('status', 'awaiting_response');

  const { count: reviewCount } = await supabase
    .from('email_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .neq('ai_priority', 'high');

  const { count: fyiCount } = await supabase
    .from('email_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('status', 'processed');

  const { count: draftsCount } = await supabase
    .from('email_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('has_pending_draft', true);

  // Check sync state
  const { data: syncState } = await supabase
    .from('email_sync_state')
    .select('*')
    .eq('user_id', profile.id)
    .single();

  // Always use new conversation-based inbox
  const counts = {
    respond: respondCount || 0,
    follow_up: followUpCount || 0,
    review: reviewCount || 0,
    drafts: draftsCount || 0,
    fyi: fyiCount || 0,
  };

  // Transform conversations to expected format
  const transformedConversations = (conversations || []).map(conv => ({
    id: conv.id,
    user_id: user.id,
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
    action_queue: (conv.status === 'pending' && conv.ai_priority === 'high'
      ? 'respond'
      : conv.status === 'awaiting_response'
        ? 'follow_up'
        : conv.status === 'pending'
          ? 'review'
          : 'fyi') as 'respond' | 'follow_up' | 'review' | 'fyi',
    snoozed_until: conv.snoozed_until,
    snooze_reason: conv.snooze_reason,
    deal_id: conv.deal_id,
    company_id: conv.company_id,
    contact_id: conv.contact_id,
    link_confidence: conv.link_confidence,
    sla_deadline: conv.response_due_at,
    sla_status: conv.sla_status,
    ai_summary: conv.ai_thread_summary,
    ai_signals: conv.signals ? Object.keys(conv.signals).filter(k => conv.signals[k]) : [],
    has_pending_draft: conv.has_pending_draft,
    created_at: conv.last_message_at,
    updated_at: conv.last_message_at,
    deal: Array.isArray(conv.deal) ? conv.deal[0] : conv.deal,
    company: Array.isArray(conv.company) ? conv.company[0] : conv.company,
    contact: Array.isArray(conv.contact) ? conv.contact[0] : conv.contact,
  }));

  return (
    <div className="h-[calc(100vh-8rem)]">
      <InboxView
        initialConversations={transformedConversations}
        initialCounts={counts}
        isSynced={!!syncState}
      />
    </div>
  );
}
