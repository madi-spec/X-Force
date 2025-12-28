import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const channel = searchParams.get('channel');
  const aiOnly = searchParams.get('ai_only') === 'true';
  const linkFilter = searchParams.get('link_filter'); // 'linked' | 'unlinked' | null

  // Get latest communication per company, grouped
  // This query gets the most recent communication for each company
  let query = supabase
    .from('communications')
    .select(`
      id,
      company_id,
      contact_id,
      channel,
      direction,
      subject,
      content_preview,
      occurred_at,
      is_ai_generated,
      ai_action_type,
      our_participants,
      their_participants,
      excluded_at,
      company:companies!company_id(id, name),
      contact:contacts!contact_id(id, name, email)
    `)
    .order('occurred_at', { ascending: false });

  // Filter out excluded communications
  query = query.is('excluded_at', null);

  // Filter by linked/unlinked status
  if (linkFilter === 'linked') {
    query = query.not('company_id', 'is', null);
  } else if (linkFilter === 'unlinked') {
    query = query.is('company_id', null);
  }

  // Apply filters
  if (aiOnly) {
    query = query.eq('is_ai_generated', true);
  } else if (channel) {
    query = query.eq('channel', channel);
  }

  const { data: allComms, error } = await query;

  if (error) {
    console.error('[Conversations API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by company (or by sender email for unlinked)
  const companyMap = new Map<string, {
    company_id: string | null;
    company_name: string;
    contact_id: string | null;
    contact_name: string | null;
    sender_email: string | null;
    is_unlinked: boolean;
    last_communication: {
      id: string;
      channel: string;
      subject: string | null;
      content_preview: string | null;
      occurred_at: string;
      direction: string;
      is_ai_generated: boolean;
    };
    communication_count: number;
    tags: string[];
  }>();

  for (const comm of allComms || []) {
    // For unlinked communications, group by sender email
    let key: string;
    let companyName: string;
    let senderEmail: string | null = null;
    const isUnlinked = !comm.company_id;

    if (isUnlinked) {
      // Extract sender email from participants
      const theirParticipants = comm.their_participants as Array<{ email?: string; name?: string }> || [];
      const ourParticipants = comm.our_participants as Array<{ email?: string; name?: string }> || [];

      // For inbound, use their_participants; for outbound, still use their_participants (the recipient)
      const primaryParticipant = theirParticipants[0] || ourParticipants[0];
      senderEmail = primaryParticipant?.email || null;

      // Use email domain or full email as key
      if (senderEmail) {
        key = `unlinked:${senderEmail}`;
        companyName = primaryParticipant?.name || senderEmail.split('@')[1] || senderEmail;
      } else {
        key = `unlinked:unknown:${comm.id}`;
        companyName = 'Unknown Sender';
      }
    } else {
      key = comm.company_id;
      // Supabase returns joined relations - handle both array and object cases
      const companyRaw = comm.company as unknown;
      const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
      companyName = (company as { name?: string })?.name || 'Unknown';
    }

    if (!companyMap.has(key)) {
      const contactRaw = comm.contact as unknown;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] : contactRaw;

      companyMap.set(key, {
        company_id: comm.company_id,
        company_name: companyName,
        contact_id: comm.contact_id,
        contact_name: (contact as { name?: string })?.name || null,
        sender_email: senderEmail,
        is_unlinked: isUnlinked,
        last_communication: {
          id: comm.id,
          channel: comm.channel,
          subject: comm.subject,
          content_preview: comm.content_preview,
          occurred_at: comm.occurred_at,
          direction: comm.direction,
          is_ai_generated: comm.is_ai_generated,
        },
        communication_count: 1,
        tags: isUnlinked ? ['Unlinked'] : [],
      });
    } else {
      const existing = companyMap.get(key)!;
      existing.communication_count++;
    }
  }

  // Get communications that have open attention flags
  const { data: openFlags } = await supabase
    .from('attention_flags')
    .select('source_id')
    .eq('source_type', 'communication')
    .eq('status', 'open')
    .not('source_id', 'is', null);

  const commIdsWithOpenFlags = new Set(
    (openFlags || []).map(f => f.source_id).filter(Boolean)
  );

  // Also get communications that are awaiting our response (needsReply in Daily Driver)
  const { data: awaitingResponse } = await supabase
    .from('communications')
    .select('id')
    .eq('awaiting_our_response', true)
    .is('responded_at', null);

  const commIdsAwaitingResponse = new Set(
    (awaitingResponse || []).map(c => c.id)
  );

  // Convert to array and sort by last communication
  const conversations = Array.from(companyMap.values())
    .map(conv => ({
      ...conv,
      has_open_task: commIdsWithOpenFlags.has(conv.last_communication.id) ||
                     commIdsAwaitingResponse.has(conv.last_communication.id),
    }))
    .sort((a, b) =>
      new Date(b.last_communication.occurred_at).getTime() -
      new Date(a.last_communication.occurred_at).getTime()
    );

  return NextResponse.json({ conversations });
}
