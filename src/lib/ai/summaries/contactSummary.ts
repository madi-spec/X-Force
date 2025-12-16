/**
 * Contact Summary Generator
 * Generates AI-powered summaries for contacts
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson, logAIUsage } from '../core/aiClient';
import { createHash } from 'crypto';
import type { ContactSummary, GenerateSummaryOptions, SummaryResult } from './types';

// ============================================
// TYPES
// ============================================

interface ContactContext {
  contact: {
    id: string;
    name: string;
    title: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  company: {
    id: string;
    name: string;
    status: string;
    segment: string;
    industry: string;
  } | null;
  activities: Array<{
    id: string;
    type: string;
    subject: string | null;
    body: string | null;
    occurred_at: string;
    sentiment: string | null;
  }>;
  deals: Array<{
    id: string;
    name: string;
    stage: string;
    estimated_value: number | null;
  }>;
}

// ============================================
// CONTEXT GATHERING
// ============================================

async function gatherContactContext(contactId: string, options: GenerateSummaryOptions = {}): Promise<ContactContext> {
  const supabase = createAdminClient();
  const maxActivities = options.maxActivities || 30;

  // Fetch contact with company
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(`
      id, name, title, role, email, phone, notes, created_at, updated_at,
      company:companies(id, name, status, segment, industry)
    `)
    .eq('id', contactId)
    .single();

  if (contactError || !contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  // Handle company being array or object
  const companyData = Array.isArray(contact.company) ? contact.company[0] : contact.company;

  // Fetch activities involving this contact
  // Activities are linked via company_id, filter by contact mentions in metadata or subject
  let activities: ContactContext['activities'] = [];
  if (companyData?.id) {
    const { data: companyActivities } = await supabase
      .from('activities')
      .select('id, type, subject, body, occurred_at, sentiment')
      .eq('company_id', companyData.id)
      .order('occurred_at', { ascending: false })
      .limit(maxActivities);

    activities = companyActivities || [];
  }

  // Fetch deals for the company
  let deals: ContactContext['deals'] = [];
  if (companyData?.id) {
    const { data: companyDeals } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value')
      .eq('company_id', companyData.id)
      .not('stage', 'eq', 'closed_lost');

    deals = companyDeals || [];
  }

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      title: contact.title,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      notes: contact.notes,
      created_at: contact.created_at,
      updated_at: contact.updated_at,
    },
    company: companyData || null,
    activities,
    deals,
  };
}

// ============================================
// HASH GENERATION
// ============================================

function generateContextHash(context: ContactContext): string {
  const hashInput = JSON.stringify({
    contactId: context.contact.id,
    role: context.contact.role,
    activityCount: context.activities.length,
    lastActivityDate: context.activities[0]?.occurred_at || null,
    dealCount: context.deals.length,
    updatedAt: context.contact.updated_at,
  });

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildContactSummaryPrompt(context: ContactContext): string {
  const { contact, company, activities, deals } = context;

  // Calculate engagement metrics
  const lastActivity = activities[0];
  const daysSinceContact = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.occurred_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Activity type breakdown
  const activityTypes: Record<string, number> = {};
  activities.forEach(a => {
    activityTypes[a.type] = (activityTypes[a.type] || 0) + 1;
  });

  // Sentiment analysis
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  activities.forEach(a => {
    if (a.sentiment === 'positive') sentimentCounts.positive++;
    else if (a.sentiment === 'negative') sentimentCounts.negative++;
    else sentimentCounts.neutral++;
  });

  // Extract communication content for analysis
  const recentComms = activities.slice(0, 10).map(a => ({
    date: new Date(a.occurred_at).toLocaleDateString(),
    type: a.type,
    subject: a.subject || 'No subject',
    preview: a.body ? a.body.substring(0, 200) : '',
    sentiment: a.sentiment,
  }));

  return `Generate a comprehensive summary for this contact person.

## Contact Information
- Name: ${contact.name}
- Title: ${contact.title || 'Not specified'}
- Role: ${contact.role || 'Not specified'}
- Email: ${contact.email || 'Not specified'}
- Phone: ${contact.phone || 'Not specified'}
${contact.notes ? `- Notes: ${contact.notes}` : ''}
- In CRM Since: ${new Date(contact.created_at).toLocaleDateString()}

## Company
${company ? `
- Company: ${company.name}
- Status: ${company.status}
- Segment: ${company.segment}
- Industry: ${company.industry}
` : 'No company linked'}

## Active Deals (${deals.length})
${deals.length > 0 ? deals.map(d =>
    `- ${d.name} (${d.stage}) - ${d.estimated_value ? `$${d.estimated_value.toLocaleString()}` : 'Value TBD'}`
  ).join('\n') : 'No active deals'}

## Engagement History
- Total Interactions: ${activities.length}
- Days Since Last Contact: ${daysSinceContact}
- Sentiment Breakdown: ${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.negative} negative
${Object.keys(activityTypes).length > 0 ? `\nActivity Types:\n${Object.entries(activityTypes).map(([type, count]) => `  - ${type}: ${count}`).join('\n')}` : ''}

## Recent Communications
${recentComms.length > 0 ? recentComms.map(c =>
    `- ${c.date} [${c.type}] ${c.subject}${c.sentiment ? ` (${c.sentiment})` : ''}\n  ${c.preview}...`
  ).join('\n\n') : 'No recent communications'}

---

Analyze this contact and provide a comprehensive JSON summary:

{
  "headline": "One sentence capturing this person's role and relationship status",
  "overview": "2-3 paragraphs about this contact, their role, engagement history, and relationship",

  "profile": {
    "name": "${contact.name}",
    "title": ${contact.title ? `"${contact.title}"` : 'null'},
    "role": ${contact.role ? `"${contact.role}"` : 'null'},
    "company": "${company?.name || 'Unknown'}",
    "email": ${contact.email ? `"${contact.email}"` : 'null'},
    "phone": ${contact.phone ? `"${contact.phone}"` : 'null'}
  },

  "influence": {
    "decisionMakingRole": "decision_maker|influencer|champion|end_user|blocker|unknown",
    "buyingInfluence": "high|medium|low",
    "sentiment": "positive|neutral|negative|unknown",
    "engagementLevel": "highly_engaged|engaged|passive|disengaged"
  },

  "communication": {
    "preferredChannel": "email|phone|meeting|unknown",
    "responsePattern": "Description of how they typically respond",
    "bestTimeToReach": "Inferred best time or null"
  },

  "engagement": {
    "totalInteractions": ${activities.length},
    "lastContactDate": "${lastActivity?.occurred_at || null}",
    "daysSinceContact": ${daysSinceContact},
    "interactionTypes": ${JSON.stringify(activityTypes)}
  },

  "keyInsights": [
    {"insight": "Important observation about this contact", "source": "Where this was learned"}
  ],

  "painPoints": ["Pain points this person has mentioned or shown"],

  "interests": ["Topics or areas they've shown interest in"],

  "relationshipTips": ["Tips for building relationship with this contact"],

  "confidence": 0.85
}

Be specific. Infer from the communication patterns and content. Focus on actionable insights for sales.`;
}

// ============================================
// MAIN GENERATOR
// ============================================

export async function generateContactSummary(
  contactId: string,
  options: GenerateSummaryOptions = {}
): Promise<SummaryResult<ContactSummary>> {
  const supabase = createAdminClient();
  const startTime = Date.now();

  // Gather context
  const context = await gatherContactContext(contactId, options);
  const contextHash = generateContextHash(context);

  // Check for existing summary if not forcing regeneration
  if (!options.force) {
    const { data: existing } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('contact_id', contactId)
      .eq('summary_type', 'contact_overview')
      .single();

    if (existing && !existing.stale && existing.context_hash === contextHash) {
      return {
        summary: existing.summary as ContactSummary,
        isNew: false,
        wasStale: false,
        contextHash,
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Generate new summary
  const prompt = buildContactSummaryPrompt(context);

  const { data: summary, usage, latencyMs } = await callAIJson<ContactSummary>({
    prompt,
    maxTokens: 1500,
    temperature: 0.3,
  });

  const enrichedSummary: ContactSummary = {
    ...summary,
    generatedAt: new Date().toISOString(),
  };

  const summaryText = `${enrichedSummary.headline}\n\n${enrichedSummary.overview}`;

  // Save to database
  const { data: existingRecord } = await supabase
    .from('ai_summaries')
    .select('id')
    .eq('contact_id', contactId)
    .eq('summary_type', 'contact_overview')
    .single();

  if (existingRecord) {
    await supabase
      .from('ai_summaries')
      .update({
        summary: enrichedSummary,
        summary_text: summaryText,
        key_points: enrichedSummary.keyInsights.map(ki => ki.insight),
        risks: [], // Contacts don't have risks in the same way
        opportunities: enrichedSummary.interests,
        generated_at: new Date().toISOString(),
        context_hash: contextHash,
        stale: false,
        model_used: 'claude-sonnet-4-20250514',
        tokens_used: usage.inputTokens + usage.outputTokens,
        confidence: enrichedSummary.confidence,
      })
      .eq('id', existingRecord.id);
  } else {
    await supabase.from('ai_summaries').insert({
      contact_id: contactId,
      summary_type: 'contact_overview',
      summary: enrichedSummary,
      summary_text: summaryText,
      key_points: enrichedSummary.keyInsights.map(ki => ki.insight),
      risks: [],
      opportunities: enrichedSummary.interests,
      generated_at: new Date().toISOString(),
      context_hash: contextHash,
      stale: false,
      model_used: 'claude-sonnet-4-20250514',
      tokens_used: usage.inputTokens + usage.outputTokens,
      confidence: enrichedSummary.confidence,
    });
  }

  // Log AI usage
  await logAIUsage(supabase, {
    insightType: 'contact_summary',
    contactId,
    companyId: context.company?.id,
    usage,
    latencyMs,
    model: 'claude-sonnet-4-20250514',
    data: { contextHash },
  });

  return {
    summary: enrichedSummary,
    isNew: !existingRecord,
    wasStale: !!existingRecord,
    contextHash,
    tokensUsed: usage.inputTokens + usage.outputTokens,
    latencyMs: Date.now() - startTime,
  };
}

// ============================================
// RETRIEVAL
// ============================================

export async function getContactSummary(contactId: string): Promise<ContactSummary | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('ai_summaries')
    .select('summary')
    .eq('contact_id', contactId)
    .eq('summary_type', 'contact_overview')
    .single();

  if (!data) return null;

  return data.summary as ContactSummary;
}

// ============================================
// STALENESS CHECK
// ============================================

export async function isContactSummaryStale(contactId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('ai_summaries')
    .select('stale, generated_at')
    .eq('contact_id', contactId)
    .eq('summary_type', 'contact_overview')
    .single();

  if (!data) return true;
  if (data.stale) return true;

  const generatedAt = new Date(data.generated_at);
  const hoursSinceGeneration = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceGeneration > 72; // Contacts can be cached even longer
}
