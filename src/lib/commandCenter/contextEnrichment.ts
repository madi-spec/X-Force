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
}

interface EnrichmentResult {
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
      .select('id, name, stage, estimated_value, probability, health_score, stage_changed_at, last_activity_at')
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
  why_now?: string;
}

interface AIEnrichmentOutput {
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

  const prompt = `You are a sales coach helping a rep prioritize their day across 200+ deals. They cannot remember specifics about each deal. Your job is to CONVINCE them why THIS action on THIS deal deserves their attention RIGHT NOW.

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
` : 'No deal linked - this is an orphan action'}

CONTACT: ${input.target_name || 'Unknown'}
ACTION REQUESTED: ${input.title}

${input.recent_emails?.length ? `
RECENT EMAIL THREAD:
${input.recent_emails.slice(0, 3).map(e => `- [${e.direction.toUpperCase()}] ${e.subject}: "${e.snippet}"`).join('\n')}
` : 'No recent email history.'}

${input.recent_activities?.length ? `
RECENT ACTIVITY:
${input.recent_activities.slice(0, 3).map(a => `- ${a.type}: ${a.subject}`).join('\n')}
` : 'No recent activity logged.'}

Based on this context, provide:

1. context_summary: In 2-3 sentences, tell the rep:
   - What's the business case? (deal size, stage, momentum)
   - What happened recently that makes this timely? (last meeting, email, signal)
   - What's at stake if they DON'T act? (deal at risk, competitor, going dark)
   DO NOT mention "overdue" - focus on OPPORTUNITY and RISK.

2. considerations: 2-4 specific tactical points:
   - Buying signals or red flags from the data
   - What to reference from recent conversations
   - Stakeholder dynamics if known
   - Competitive intelligence if relevant

${['email_send_draft', 'email_compose', 'email_respond', 'meeting_follow_up'].includes(input.action_type) ? `
3. email_subject: A specific, compelling subject line (reference something from context)
4. email_body: A brief email (2-3 paragraphs) that:
   - References the last interaction specifically
   - Proposes a clear next step
   - Creates urgency without being pushy
` : ''}

Be SPECIFIC. Use actual names, dates, and numbers from the context. Generic advice is useless.`;

  const schema = `{
  "context_summary": "string - 2-3 sentence business case with deal value, recent activity, and stakes",
  "considerations": ["string array - 2-4 specific tactical points from the data"],
  ${['email_send_draft', 'email_compose', 'email_respond', 'meeting_follow_up'].includes(input.action_type) ? `
  "email_subject": "string - specific subject referencing context",
  "email_body": "string - personalized email body"
  ` : ''}
}`;

  try {
    const result = await callAIJson<AIEnrichmentOutput>({
      prompt,
      schema,
      maxTokens: 1000,
      temperature: 0.7,
      model: 'claude-3-haiku-20240307', // Use haiku for speed
    });

    return result.data;
  } catch (error) {
    console.error('[ContextEnrichment] AI enrichment failed:', error);
    // Return fallback
    return {
      context_summary: input.why_now || `${input.action_type} action for ${input.company_name || input.target_name || 'this contact'}`,
      considerations: ['Review the context before taking action', 'Be prepared with relevant information'],
    };
  }
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
  // Gather context
  const context = await gatherContext(item);

  // Generate AI enrichment
  const aiResult = await generateAIEnrichment({
    action_type: item.action_type,
    title: item.title,
    target_name: item.target_name || undefined,
    company_name: item.company_name || undefined,
    deal: context.deal,
    contact: context.contact,
    recent_emails: context.recentEmails,
    recent_activities: context.recentActivities,
    why_now: item.why_now || undefined,
  });

  // Build result
  const result: EnrichmentResult = {
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

  // Save to database
  const { error: updateError } = await supabase
    .from('command_center_items')
    .update({
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

  // Gather context and regenerate
  const context = await gatherContext(item as CommandCenterItem);
  const aiResult = await generateAIEnrichment({
    action_type: item.action_type,
    title: item.title,
    target_name: item.target_name || undefined,
    company_name: item.company_name || undefined,
    deal: context.deal,
    contact: context.contact,
    recent_emails: context.recentEmails,
    recent_activities: context.recentActivities,
    why_now: item.why_now || undefined,
  });

  if (!aiResult.email_subject || !aiResult.email_body) {
    throw new Error('Failed to generate email draft');
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
