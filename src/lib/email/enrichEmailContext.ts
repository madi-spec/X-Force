/**
 * Email Context Enrichment
 *
 * Before AI analysis, gather everything we know about the sender:
 * - Contact record (find or create)
 * - Company (from domain)
 * - Active deal
 * - Interaction history (emails + meetings)
 * - Recent meeting summaries
 * - Thread context
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export interface InboundEmail {
  id: string;
  user_id: string;
  conversation_ref: string;
  message_id: string;
  subject: string | null;
  from_email: string;
  from_name: string | null;
  body_text: string | null;
  body_preview: string | null;
  body_html: string | null;
  received_at: string;
  is_sent_by_user: boolean;
}

export interface EnrichedContact {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  company_id: string | null;
  phone: string | null;
  created_new: boolean;
}

export interface EnrichedCompany {
  id: string;
  name: string;
  industry: string | null;
  segment: string | null;
  employee_count: number | null;
  website: string | null;
  city: string | null;
  state: string | null;
}

export interface EnrichedDeal {
  id: string;
  name: string;
  stage: string;
  estimated_value: number | null;
  expected_close_date: string | null;
  health_score: number | null;
  days_since_activity: number | null;
}

export interface Interaction {
  id: string;
  type: 'email_sent' | 'email_received' | 'meeting' | 'call' | 'note';
  date: string;
  summary: string;
  subject?: string;
  direction?: 'inbound' | 'outbound';
}

export interface MeetingSummary {
  id: string;
  title: string;
  date: string;
  summary: string | null;
  key_points: string[];
  commitments: string[];
  sentiment: string | null;
  buying_signals: string[];
}

export interface ThreadEmail {
  id: string;
  direction: 'inbound' | 'outbound';
  sent_at: string;
  from_name: string | null;
  body_preview: string | null;
}

export interface EmailContext {
  contact: EnrichedContact | null;
  company: EnrichedCompany | null;
  deal: EnrichedDeal | null;
  history: Interaction[];
  threadEmails: ThreadEmail[];
  recentMeetings: MeetingSummary[];
  lastContactDays: number | null;
  totalInteractions: number;
  relationshipStage: string;
}

// ============================================
// PERSONAL EMAIL DOMAINS
// ============================================

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'live.com',
  'msn.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
  'ymail.com',
  'comcast.net',
  'att.net',
  'verizon.net',
  'sbcglobal.net',
  'cox.net',
  'charter.net',
]);

// Internal domains to skip
const INTERNAL_DOMAINS = new Set([
  'xrailabsteam.com',
  'xrailabs.com',
  'affiliatedtech.com',
  'x-rai.com',
]);

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractDomain(email: string): string {
  return email.toLowerCase().split('@')[1] || '';
}

function isPersonalEmail(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase());
}

function isInternalEmail(domain: string): boolean {
  return INTERNAL_DOMAINS.has(domain.toLowerCase());
}

function domainToCompanyName(domain: string): string {
  // debugpest.com → Debug Pest
  // lawn-doctor.com → Lawn Doctor
  return domain
    .replace(/\.(com|net|org|io|co|biz|us|info)$/, '')
    .split(/[-_.]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function calculateDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function inferRelationshipStage(
  contact: EnrichedContact | null,
  deal: EnrichedDeal | null,
  totalInteractions: number
): string {
  if (!contact && totalInteractions === 0) return 'new_contact';
  if (!deal && totalInteractions > 0) return 'known_contact';
  if (deal?.stage === 'closed_won') return 'customer';
  if (deal?.stage === 'closed_lost') return 'lost_opportunity';
  if (deal) return 'active_prospect';
  return 'unknown';
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function enrichEmailContext(email: InboundEmail): Promise<EmailContext> {
  const supabase = createAdminClient();
  const domain = extractDomain(email.from_email);
  const emailLower = email.from_email.toLowerCase();

  let contact: EnrichedContact | null = null;
  let company: EnrichedCompany | null = null;
  let deal: EnrichedDeal | null = null;
  const history: Interaction[] = [];
  const threadEmails: ThreadEmail[] = [];
  const recentMeetings: MeetingSummary[] = [];

  // ----------------------------------------
  // 1. Find or create contact
  // ----------------------------------------
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, email, title, company_id, phone')
    .ilike('email', emailLower)
    .single();

  if (existingContact) {
    contact = {
      ...existingContact,
      email: existingContact.email || emailLower,
      created_new: false,
    };
  }
  // Note: New contact creation is deferred until we have a company_id

  // ----------------------------------------
  // 2. Find or create company from domain
  // ----------------------------------------
  if (!isPersonalEmail(domain) && !isInternalEmail(domain)) {
    // First check if contact already has a company
    if (contact?.company_id) {
      const { data: linkedCompany } = await supabase
        .from('companies')
        .select('id, name, industry, segment, website, city, state')
        .eq('id', contact.company_id)
        .single();

      if (linkedCompany) {
        company = {
          ...linkedCompany,
          employee_count: null, // Not stored directly
        };
      }
    }

    // If no company from contact, try domain matching
    if (!company) {
      const { data: domainCompany } = await supabase
        .from('companies')
        .select('id, name, industry, segment, website, city, state')
        .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
        .single();

      if (domainCompany) {
        company = {
          ...domainCompany,
          employee_count: null,
        };
      } else {
        // Create placeholder company from domain
        // Include required fields: segment defaults to 'smb'
        const { data: newCompany, error } = await supabase
          .from('companies')
          .insert({
            name: domainToCompanyName(domain),
            domain: domain,
            status: 'prospect',
            segment: 'smb', // Required field
            industry: 'pest', // Default industry
          })
          .select('id, name, industry, segment, website, city, state')
          .single();

        if (!error && newCompany) {
          company = {
            ...newCompany,
            employee_count: null,
          };
        }
      }
    }

    // Now create contact if we don't have one and we have a company
    if (!contact && company && !isInternalEmail(domain)) {
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          email: emailLower,
          name: email.from_name || emailLower.split('@')[0],
          company_id: company.id, // Required field
        })
        .select('id, name, email, title, company_id, phone')
        .single();

      if (!error && newContact) {
        contact = {
          ...newContact,
          email: newContact.email || emailLower,
          created_new: true,
        };
      }
    }
  }

  // ----------------------------------------
  // 3. Find active deal
  // ----------------------------------------
  if (contact?.company_id || company?.id) {
    const companyId = contact?.company_id || company?.id;

    const { data: activeDeal } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value, expected_close_date, health_score, days_since_activity')
      .eq('company_id', companyId!)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activeDeal) {
      deal = activeDeal;
    }
  }

  // ----------------------------------------
  // 4. Get interaction history (last 10)
  // ----------------------------------------
  const entityFilters: string[] = [];
  if (contact?.id) entityFilters.push(`contact_id.eq.${contact.id}`);
  if (company?.id) entityFilters.push(`company_id.eq.${company.id}`);
  if (deal?.id) entityFilters.push(`deal_id.eq.${deal.id}`);

  if (entityFilters.length > 0) {
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, subject, description, occurred_at')
      .or(entityFilters.join(','))
      .order('occurred_at', { ascending: false })
      .limit(10);

    if (activities) {
      for (const activity of activities) {
        history.push({
          id: activity.id,
          type: activity.type as Interaction['type'],
          date: activity.occurred_at,
          summary: activity.description || activity.subject || '',
          subject: activity.subject || undefined,
        });
      }
    }
  }

  // Also get email history from email_messages
  if (contact?.id || company?.id) {
    // Get conversations linked to contact/company
    const convFilters: string[] = [];
    if (contact?.id) convFilters.push(`contact_id.eq.${contact.id}`);
    if (company?.id) convFilters.push(`company_id.eq.${company.id}`);

    const { data: conversations } = await supabase
      .from('email_conversations')
      .select('id')
      .or(convFilters.join(','));

    if (conversations && conversations.length > 0) {
      const convIds = conversations.map(c => c.id);

      const { data: emails } = await supabase
        .from('email_messages')
        .select('id, subject, body_preview, is_sent_by_user, received_at')
        .in('conversation_ref', convIds)
        .order('received_at', { ascending: false })
        .limit(10);

      if (emails) {
        for (const em of emails) {
          const existing = history.find(h => h.id === em.id);
          if (!existing) {
            history.push({
              id: em.id,
              type: em.is_sent_by_user ? 'email_sent' : 'email_received',
              date: em.received_at || '',
              summary: em.body_preview || '',
              subject: em.subject || undefined,
              direction: em.is_sent_by_user ? 'outbound' : 'inbound',
            });
          }
        }
      }
    }
  }

  // Sort history by date descending and limit to 10
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  history.splice(10);

  // ----------------------------------------
  // 5. Get thread context
  // ----------------------------------------
  const { data: thread } = await supabase
    .from('email_messages')
    .select('id, is_sent_by_user, received_at, from_name, body_preview')
    .eq('conversation_ref', email.conversation_ref)
    .neq('id', email.id) // Exclude current email
    .order('received_at', { ascending: false })
    .limit(5);

  if (thread) {
    for (const msg of thread) {
      threadEmails.push({
        id: msg.id,
        direction: msg.is_sent_by_user ? 'outbound' : 'inbound',
        sent_at: msg.received_at || '',
        from_name: msg.from_name,
        body_preview: msg.body_preview,
      });
    }
  }

  // ----------------------------------------
  // 6. Get recent meeting summaries (last 30 days)
  // ----------------------------------------
  if (contact?.id || company?.id || deal?.id) {
    const meetingFilters: string[] = [];
    if (contact?.id) meetingFilters.push(`contact_id.eq.${contact.id}`);
    if (company?.id) meetingFilters.push(`company_id.eq.${company.id}`);
    if (deal?.id) meetingFilters.push(`deal_id.eq.${deal.id}`);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: meetings } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date, summary, analysis')
      .or(meetingFilters.join(','))
      .gte('meeting_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('meeting_date', { ascending: false })
      .limit(3);

    if (meetings) {
      for (const meeting of meetings) {
        const analysis = meeting.analysis as {
          keyPoints?: Array<{ topic: string }>;
          ourCommitments?: Array<{ commitment: string }>;
          theirCommitments?: Array<{ commitment: string }>;
          sentiment?: { overall: string };
          buyingSignals?: Array<{ signal: string }>;
        } | null;

        recentMeetings.push({
          id: meeting.id,
          title: meeting.title,
          date: meeting.meeting_date,
          summary: meeting.summary,
          key_points: analysis?.keyPoints?.map(k => k.topic) || [],
          commitments: [
            ...(analysis?.ourCommitments?.map(c => `Us: ${c.commitment}`) || []),
            ...(analysis?.theirCommitments?.map(c => `Them: ${c.commitment}`) || []),
          ],
          sentiment: analysis?.sentiment?.overall || null,
          buying_signals: analysis?.buyingSignals?.map(s => s.signal) || [],
        });
      }
    }
  }

  // ----------------------------------------
  // Calculate summary metrics
  // ----------------------------------------
  const lastContactDate = history.length > 0 ? history[0].date : null;
  const lastContactDays = calculateDaysSince(lastContactDate);
  const totalInteractions = history.length;
  const relationshipStage = inferRelationshipStage(contact, deal, totalInteractions);

  return {
    contact,
    company,
    deal,
    history,
    threadEmails,
    recentMeetings,
    lastContactDays,
    totalInteractions,
    relationshipStage,
  };
}

// ============================================
// HELPER: Get email by ID
// ============================================

export async function getEmailById(emailId: string): Promise<InboundEmail | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('email_messages')
    .select(`
      id,
      user_id,
      conversation_ref,
      message_id,
      subject,
      from_email,
      from_name,
      body_text,
      body_preview,
      body_html,
      received_at,
      is_sent_by_user
    `)
    .eq('id', emailId)
    .single();

  if (error || !data) return null;

  return data as InboundEmail;
}
