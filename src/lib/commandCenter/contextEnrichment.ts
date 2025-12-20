/**
 * Context Enrichment Service for Command Center
 *
 * Generates rich context for action items including:
 * - Context summaries
 * - Considerations/warnings
 * - Source links
 * - Email drafts
 * - Schedule suggestions
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';
import {
  CommandCenterItem,
  SourceLink,
  PrimaryContact,
  EmailDraft,
  ScheduleSuggestions,
  AvailableAction,
} from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface ContextData {
  // Item info
  item: CommandCenterItem;

  // Related entities
  deal?: {
    id: string;
    name: string;
    stage: string;
    estimated_value: number;
    probability: number;
    health_score?: number;
    days_in_stage?: number;
    last_activity_at?: string;
    expected_close_date?: string;
  };
  company?: {
    id: string;
    name: string;
    industry?: string;
    website?: string;
  };
  contact?: {
    id: string;
    name: string;
    email?: string;
    title?: string;
    phone?: string;
  };

  // Historical data
  recentEmails?: Array<{
    subject: string;
    snippet: string;
    direction: 'inbound' | 'outbound';
    created_at: string;
  }>;
  recentMeetings?: Array<{
    subject: string;
    notes?: string;
    date: string;
  }>;
  recentActivities?: Array<{
    type: string;
    subject: string;
    description?: string;
    created_at: string;
  }>;

  // Meeting transcriptions with analysis
  recentTranscripts?: Array<{
    id: string;
    title: string;
    meeting_date: string;
    summary?: string;
    analysis?: {
      nextSteps?: Array<{ action: string; owner: string; dueDate?: string }>;
      commitments?: Array<{ commitment: string; by: string }>;
      buyingSignals?: Array<{ signal: string; strength: string }>;
      objections?: Array<{ objection: string; resolved: boolean }>;
    };
  }>;

  // Engagement tracking
  engagementSignals?: Array<{
    type: string;
    description: string;
    occurred_at: string;
    count?: number;
  }>;
}

interface EnrichmentResult {
  why_now: string | null;  // Specific, contextual reason - null if no specific data
  context_summary: string;
  considerations: string[];
  source_links: SourceLink[];
  primary_contact?: PrimaryContact;
  email_draft?: EmailDraft;
  schedule_suggestions?: ScheduleSuggestions;
  available_actions: AvailableAction[];
}

// ============================================
// CONTEXT GATHERING
// ============================================

/**
 * Gather all relevant context for an item
 */
export async function gatherContext(item: CommandCenterItem): Promise<ContextData> {
  const supabase = createAdminClient();
  const context: ContextData = { item };

  // Fetch deal if available
  if (item.deal_id) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value, probability, health_score, stage_changed_at, last_activity_at, expected_close_date')
      .eq('id', item.deal_id)
      .single();

    if (deal) {
      context.deal = {
        ...deal,
        days_in_stage: deal.stage_changed_at
          ? Math.floor((Date.now() - new Date(deal.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
          : undefined,
      };
    }
  }

  // Fetch company if available
  if (item.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, industry, website')
      .eq('id', item.company_id)
      .single();

    if (company) {
      context.company = company;
    }
  }

  // Fetch primary contact
  if (item.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, email, title, phone')
      .eq('id', item.contact_id)
      .single();

    if (contact) {
      context.contact = contact;
    }
  }

  // Fetch recent emails (last 5)
  if (item.company_id || item.contact_id) {
    const { data: emails } = await supabase
      .from('email_conversations')
      .select('subject, snippet, direction, created_at')
      .or(
        item.company_id
          ? `company_id.eq.${item.company_id}`
          : `contact_id.eq.${item.contact_id}`
      )
      .order('created_at', { ascending: false })
      .limit(5);

    if (emails && emails.length > 0) {
      context.recentEmails = emails;
    }
  }

  // Fetch recent activities (last 5)
  if (item.company_id || item.deal_id) {
    const { data: activities } = await supabase
      .from('activities')
      .select('type, subject, description, created_at')
      .or(
        item.deal_id
          ? `deal_id.eq.${item.deal_id}`
          : `company_id.eq.${item.company_id}`
      )
      .order('created_at', { ascending: false })
      .limit(5);

    if (activities && activities.length > 0) {
      context.recentActivities = activities;
    }
  }

  // Fetch recent meeting transcriptions with analysis (last 3)
  if (item.company_id || item.deal_id) {
    const transcriptQuery = supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date, summary, analysis')
      .order('meeting_date', { ascending: false })
      .limit(3);

    if (item.deal_id) {
      transcriptQuery.eq('deal_id', item.deal_id);
    } else if (item.company_id) {
      transcriptQuery.eq('company_id', item.company_id);
    }

    const { data: transcripts } = await transcriptQuery;

    if (transcripts && transcripts.length > 0) {
      context.recentTranscripts = transcripts.map(t => ({
        id: t.id,
        title: t.title,
        meeting_date: t.meeting_date,
        summary: t.summary || undefined,
        analysis: t.analysis as {
          nextSteps?: Array<{ action: string; owner: string; dueDate?: string }>;
          commitments?: Array<{ commitment: string; by: string }>;
          buyingSignals?: Array<{ signal: string; strength: string }>;
          objections?: Array<{ objection: string; resolved: boolean }>;
        },
      }));
    }
  }

  // Fetch engagement signals (document views, link clicks, etc.)
  if (item.deal_id || item.company_id) {
    const { data: signals } = await supabase
      .from('engagement_events')
      .select('event_type, description, occurred_at, metadata')
      .or(
        item.deal_id
          ? `deal_id.eq.${item.deal_id}`
          : `company_id.eq.${item.company_id}`
      )
      .order('occurred_at', { ascending: false })
      .limit(10);

    if (signals && signals.length > 0) {
      context.engagementSignals = signals.map(s => ({
        type: s.event_type,
        description: s.description || s.event_type,
        occurred_at: s.occurred_at,
        count: (s.metadata as { count?: number })?.count,
      }));
    }
  }

  return context;
}

// ============================================
// AI ENRICHMENT
// ============================================

interface AIEnrichmentInput {
  action_type: string;
  title: string;
  target_name?: string;
  company_name?: string;
  deal?: ContextData['deal'];
  contact?: ContextData['contact'];
  recent_emails?: ContextData['recentEmails'];
  recent_activities?: ContextData['recentActivities'];
  recent_transcripts?: ContextData['recentTranscripts'];
  engagement_signals?: ContextData['engagementSignals'];
  existing_why_now?: string;
}

interface AIEnrichmentOutput {
  why_now: string | null;  // MUST be specific or null
  context_summary: string;
  considerations: string[];
  email_subject?: string;
  email_body?: string;
}

/**
 * Generate AI-powered context enrichment
 */
async function generateAIEnrichment(input: AIEnrichmentInput): Promise<AIEnrichmentOutput> {
  // Calculate weighted value (deal value * probability)
  const weightedValue = input.deal
    ? (input.deal.estimated_value || 0) * (input.deal.probability || 0.5)
    : 0;

  // Calculate days since last email response
  const lastInboundEmail = input.recent_emails?.find(e => e.direction === 'inbound');
  const lastOutboundEmail = input.recent_emails?.find(e => e.direction === 'outbound');
  const daysSinceResponse = lastOutboundEmail && !lastInboundEmail
    ? Math.floor((Date.now() - new Date(lastOutboundEmail.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Format transcript commitments
  const transcriptContext = input.recent_transcripts?.map(t => {
    const meetingDate = new Date(t.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const commitments = t.analysis?.commitments || [];
    const nextSteps = t.analysis?.nextSteps || [];
    const signals = t.analysis?.buyingSignals || [];

    return `
Meeting: "${t.title}" on ${meetingDate}
${t.summary ? `Summary: ${t.summary}` : ''}
${commitments.length ? `Commitments made: ${commitments.map(c => `"${c.commitment}" (by ${c.by})`).join(', ')}` : ''}
${nextSteps.length ? `Next steps agreed: ${nextSteps.map(n => `"${n.action}" (owner: ${n.owner}${n.dueDate ? `, due: ${n.dueDate}` : ''})`).join(', ')}` : ''}
${signals.length ? `Buying signals: ${signals.map(s => s.signal).join(', ')}` : ''}`;
  }).join('\n');

  // Format engagement signals
  const engagementContext = input.engagement_signals?.slice(0, 5).map(s => {
    const date = new Date(s.occurred_at);
    const timeAgo = formatTimeAgo(date);
    return `- ${s.type}: ${s.description} (${timeAgo}${s.count ? `, ${s.count}x` : ''})`;
  }).join('\n');

  const prompt = `You are a sales coach helping a rep prioritize their day. They manage 200+ deals and cannot remember specifics. Your job is to provide SPECIFIC, DATA-DRIVEN context.

CRITICAL INSTRUCTION FOR "why_now":
The "why_now" field MUST contain a SPECIFIC reason with real data. It should be ONE sentence that references:
- A specific date, promise, or commitment from a meeting
- Engagement activity (e.g., "Sarah viewed your proposal 3x yesterday at 11pm")
- Silence duration after a specific action (e.g., "They've been silent 8 days since your pricing email on Dec 12")
- A deadline or promise made (e.g., "You promised trial access by EOW on your Dec 15 call")

NEVER use generic phrases like:
- "Voice builds trust faster than email"
- "Maintain momentum"
- "Strike while iron is hot"
- "Proposals move deals forward"
- "Important to follow up"
- Just date-based urgency like "Due today"

If you cannot find a SPECIFIC reason from the data, set why_now to null.

DEAL SNAPSHOT:
${input.deal ? `
- Company: ${input.company_name || 'Unknown'}
- Deal Value: $${input.deal.estimated_value?.toLocaleString() || '0'}
- Probability: ${input.deal.probability ? Math.round(input.deal.probability * 100) : 50}%
- Weighted Pipeline Value: $${Math.round(weightedValue).toLocaleString()}
- Stage: ${input.deal.stage}
- Health Score: ${input.deal.health_score || 'Unknown'}/100
- Days in Current Stage: ${input.deal.days_in_stage || 'Unknown'}
- Last Activity: ${input.deal.last_activity_at ? new Date(input.deal.last_activity_at).toLocaleDateString() : 'Unknown'}
${input.deal.expected_close_date ? `- Expected Close: ${new Date(input.deal.expected_close_date).toLocaleDateString()}` : ''}
` : 'No deal linked - this is an orphan action'}

CONTACT: ${input.target_name || 'Unknown'}
ACTION REQUESTED: ${input.title}

${input.recent_emails?.length ? `
EMAIL THREAD (last 3):
${input.recent_emails.slice(0, 3).map(e => {
  const date = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `- [${e.direction.toUpperCase()}] ${date}: "${e.subject}" - "${e.snippet}"`;
}).join('\n')}
${daysSinceResponse ? `\n⚠️ ${daysSinceResponse} days since your last outbound with no response` : ''}
` : 'No email history.'}

${transcriptContext ? `
MEETING TRANSCRIPTS:
${transcriptContext}
` : ''}

${engagementContext ? `
ENGAGEMENT SIGNALS:
${engagementContext}
` : ''}

${input.recent_activities?.length ? `
RECENT ACTIVITY:
${input.recent_activities.slice(0, 3).map(a => {
  const date = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `- ${date}: ${a.type} - ${a.subject}`;
}).join('\n')}
` : ''}

Based on this context, provide:

1. why_now: ONE specific sentence with real data. Examples:
   - "You promised to send the proposal by Friday on your Dec 15 call"
   - "They viewed your pricing deck 4x yesterday, last at 11:47pm"
   - "8 days silent since your pricing email - deal may be going cold"
   - "John mentioned talking to a competitor in last week's call"
   Set to null if no specific data point justifies urgency.

2. context_summary: 2-3 sentences covering:
   - Business case (deal size, stage)
   - Recent context (what happened)
   - Stakes (what happens if no action)

3. considerations: 2-4 specific tactical points from the data

${['email_send_draft', 'email_compose', 'email_respond', 'meeting_follow_up'].includes(input.action_type) ? `
4. email_subject: Specific subject referencing context
5. email_body: Brief email (2-3 paragraphs) referencing last interaction
` : ''}

Be SPECIFIC. Use actual names, dates, and numbers. Generic advice is worthless.`;

  const schema = `{
  "why_now": "string or null - ONE specific sentence with real data, or null if no specific reason",
  "context_summary": "string - 2-3 sentence business case",
  "considerations": ["string array - 2-4 specific tactical points"],
  ${['email_send_draft', 'email_compose', 'email_respond', 'meeting_follow_up'].includes(input.action_type) ? `
  "email_subject": "string - specific subject",
  "email_body": "string - personalized email body"
  ` : ''}
}`;

  try {
    const result = await callAIJson<AIEnrichmentOutput>({
      prompt,
      schema,
      maxTokens: 1200,
      temperature: 0.5,  // Lower temperature for more factual output
      model: 'claude-3-haiku-20240307',
    });

    return result.data;
  } catch (error) {
    console.error('[ContextEnrichment] AI enrichment failed:', error);
    // Return fallback with null why_now (no generic fluff)
    return {
      why_now: null,
      context_summary: input.existing_why_now || `${input.action_type} action for ${input.company_name || input.target_name || 'this contact'}`,
      considerations: ['Review the context before taking action'],
    };
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// SOURCE LINKS
// ============================================

function buildSourceLinks(context: ContextData): SourceLink[] {
  const links: SourceLink[] = [];

  // Deal link
  if (context.deal) {
    links.push({
      type: 'deal',
      label: context.deal.name,
      url: `/deals/${context.deal.id}`,
    });
  }

  // Recent email links
  if (context.recentEmails?.length) {
    links.push({
      type: 'email',
      label: `Recent Emails (${context.recentEmails.length})`,
      url: context.item.conversation_id
        ? `/inbox?id=${context.item.conversation_id}`
        : `/inbox?company=${context.item.company_id}`,
    });
  }

  // Meeting link if from calendar
  if (context.item.meeting_id) {
    links.push({
      type: 'meeting',
      label: 'Related Meeting',
      url: `/calendar?event=${context.item.meeting_id}`,
    });
  }

  return links;
}

// ============================================
// AVAILABLE ACTIONS
// ============================================

function determineAvailableActions(context: ContextData): AvailableAction[] {
  const actions: AvailableAction[] = ['complete'];

  // Can email if we have contact email
  if (context.contact?.email) {
    actions.push('email');
  }

  // Can schedule if we have contact
  if (context.contact?.email || context.contact?.name) {
    actions.push('schedule');
  }

  // Can call if we have phone
  if (context.contact?.phone) {
    actions.push('call');
  }

  return actions;
}

// ============================================
// SCHEDULE SUGGESTIONS
// ============================================

async function generateScheduleSuggestions(
  userId: string,
  context: ContextData
): Promise<ScheduleSuggestions | undefined> {
  if (!context.contact?.email) {
    return undefined;
  }

  // For now, suggest generic time slots
  // In the future, this would integrate with calendar availability
  const now = new Date();
  const suggestions: string[] = [];

  // Suggest 3 morning slots over next 3 business days
  for (let i = 1; i <= 3; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);

    // Skip weekends
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);

    // Set to 9 AM, 10 AM, or 2 PM based on slot
    const hours = [9, 10, 14];
    date.setHours(hours[i - 1], 0, 0, 0);

    suggestions.push(date.toISOString());
  }

  return {
    suggested_times: suggestions,
    duration_minutes: 30,
    meeting_title: context.item.title.startsWith('Schedule')
      ? context.item.title.replace('Schedule ', '')
      : context.item.title,
    location: 'Microsoft Teams Meeting',
  };
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

/**
 * Enrich a command center item with full context
 */
export async function enrichItem(
  userId: string,
  item: CommandCenterItem
): Promise<EnrichmentResult> {
  // Gather context including transcripts and engagement signals
  const context = await gatherContext(item);

  // Generate AI enrichment with all available context
  const aiResult = await generateAIEnrichment({
    action_type: item.action_type,
    title: item.title,
    target_name: item.target_name || undefined,
    company_name: item.company_name || undefined,
    deal: context.deal,
    contact: context.contact,
    recent_emails: context.recentEmails,
    recent_activities: context.recentActivities,
    recent_transcripts: context.recentTranscripts,
    engagement_signals: context.engagementSignals,
    existing_why_now: item.why_now || undefined,
  });

  // Build result - including the AI-generated specific why_now
  const result: EnrichmentResult = {
    why_now: aiResult.why_now,  // Will be null if no specific reason found
    context_summary: aiResult.context_summary,
    considerations: aiResult.considerations,
    source_links: buildSourceLinks(context),
    available_actions: determineAvailableActions(context),
  };

  // Add primary contact if available
  if (context.contact) {
    result.primary_contact = {
      name: context.contact.name,
      email: context.contact.email || '',
      title: context.contact.title,
      phone: context.contact.phone,
    };
  }

  // Add email draft if generated
  if (aiResult.email_subject && aiResult.email_body) {
    result.email_draft = {
      subject: aiResult.email_subject,
      body: aiResult.email_body,
      confidence: 85, // Base confidence
      generated_at: new Date().toISOString(),
    };
  }

  // Add schedule suggestions if applicable
  const scheduleSuggestions = await generateScheduleSuggestions(userId, context);
  if (scheduleSuggestions) {
    result.schedule_suggestions = scheduleSuggestions;
  }

  return result;
}

/**
 * Enrich item and save to database
 */
export async function enrichAndSaveItem(
  userId: string,
  itemId: string
): Promise<EnrichmentResult> {
  const supabase = createAdminClient();

  // Fetch item
  const { data: item, error: fetchError } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new Error(`Item not found: ${itemId}`);
  }

  // Enrich
  const enrichment = await enrichItem(userId, item as CommandCenterItem);

  // Save to database - including the new specific why_now
  const { error: updateError } = await supabase
    .from('command_center_items')
    .update({
      why_now: enrichment.why_now,  // AI-generated specific reason (or null)
      context_summary: enrichment.context_summary,
      considerations: enrichment.considerations,
      source_links: enrichment.source_links,
      primary_contact: enrichment.primary_contact,
      email_draft: enrichment.email_draft,
      schedule_suggestions: enrichment.schedule_suggestions,
      available_actions: enrichment.available_actions,
    })
    .eq('id', itemId);

  if (updateError) {
    console.error('[ContextEnrichment] Failed to save enrichment:', updateError);
    throw updateError;
  }

  return enrichment;
}

/**
 * Generate a fresh email draft for an item
 */
export async function regenerateEmailDraft(
  userId: string,
  itemId: string
): Promise<EmailDraft> {
  const supabase = createAdminClient();

  // Fetch item
  const { data: item, error } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (error || !item) {
    throw new Error(`Item not found: ${itemId}`);
  }

  // Gather full context and regenerate
  // Force action_type to email_compose so AI always generates email fields
  const context = await gatherContext(item as CommandCenterItem);
  const aiResult = await generateAIEnrichment({
    action_type: 'email_compose', // Force email generation regardless of actual action type
    title: item.title,
    target_name: item.target_name || undefined,
    company_name: item.company_name || undefined,
    deal: context.deal,
    contact: context.contact,
    recent_emails: context.recentEmails,
    recent_activities: context.recentActivities,
    recent_transcripts: context.recentTranscripts,
    engagement_signals: context.engagementSignals,
    existing_why_now: item.why_now || undefined,
  });

  // If AI fails to generate email fields, create a fallback draft
  if (!aiResult.email_subject || !aiResult.email_body) {
    const contactName = context.contact?.name || item.target_name || 'there';
    const companyName = item.company_name || context.company?.name || '';

    return {
      subject: item.title,
      body: `Hi ${contactName},\n\nI wanted to follow up regarding ${item.title.toLowerCase()}${companyName ? ` for ${companyName}` : ''}.\n\nPlease let me know if you have any questions or if there's anything I can help with.\n\nBest regards`,
      confidence: 50,
      generated_at: new Date().toISOString(),
    };
  }

  const draft: EmailDraft = {
    subject: aiResult.email_subject,
    body: aiResult.email_body,
    confidence: 85,
    generated_at: new Date().toISOString(),
  };

  // Save to database
  await supabase
    .from('command_center_items')
    .update({ email_draft: draft })
    .eq('id', itemId);

  return draft;
}
