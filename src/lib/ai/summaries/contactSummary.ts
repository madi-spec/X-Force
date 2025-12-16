/**
 * Contact Summary Generator
 * Generates AI-powered summaries for contacts
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson, logAIUsage } from '../core/aiClient';
import { getPromptWithVariables } from '../promptManager';
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
    is_primary: boolean;
    last_contacted_at: string | null;
    created_at: string;
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
  console.log('[ContactSummary] Gathering context for contact:', contactId);
  const supabase = createAdminClient();
  const maxActivities = options.maxActivities || 30;

  // Fetch contact with company
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(`
      id, name, title, role, email, phone, is_primary, last_contacted_at, created_at,
      company:companies(id, name, status, segment, industry)
    `)
    .eq('id', contactId)
    .single();

  if (contactError) {
    console.error('Supabase error fetching contact:', contactError);
    throw new Error(`Failed to fetch contact ${contactId}: ${contactError.message}`);
  }
  if (!contact) {
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
      is_primary: contact.is_primary,
      last_contacted_at: contact.last_contacted_at,
      created_at: contact.created_at,
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
    isPrimary: context.contact.is_primary,
    activityCount: context.activities.length,
    lastActivityDate: context.activities[0]?.occurred_at || null,
    lastContactedAt: context.contact.last_contacted_at,
    dealCount: context.deals.length,
  });

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

// ============================================
// PROMPT BUILDING
// ============================================

/**
 * Format contact context into template variables for the prompt
 */
function formatContactContextVariables(context: ContactContext): Record<string, string> {
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

  const contactInfo = `## Contact Information
- Name: ${contact.name}
- Title: ${contact.title || 'Not specified'}
- Role: ${contact.role || 'Not specified'}
- Email: ${contact.email || 'Not specified'}
- Phone: ${contact.phone || 'Not specified'}
- Primary Contact: ${contact.is_primary ? 'Yes' : 'No'}
${contact.last_contacted_at ? `- Last Contacted: ${new Date(contact.last_contacted_at).toLocaleDateString()}` : ''}
- In CRM Since: ${new Date(contact.created_at).toLocaleDateString()}`;

  const companyInfo = `## Company
${company ? `- Company: ${company.name}
- Status: ${company.status}
- Segment: ${company.segment}
- Industry: ${company.industry}` : 'No company linked'}`;

  const dealsInfo = `## Active Deals (${deals.length})
${deals.length > 0 ? deals.map(d =>
    `- ${d.name} (${d.stage}) - ${d.estimated_value ? `$${d.estimated_value.toLocaleString()}` : 'Value TBD'}`
  ).join('\n') : 'No active deals'}`;

  const engagementInfo = `## Engagement History
- Total Interactions: ${activities.length}
- Days Since Last Contact: ${daysSinceContact}
- Sentiment Breakdown: ${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.negative} negative
${Object.keys(activityTypes).length > 0 ? `\nActivity Types:\n${Object.entries(activityTypes).map(([type, count]) => `  - ${type}: ${count}`).join('\n')}` : ''}`;

  const communicationsInfo = `## Recent Communications
${recentComms.length > 0 ? recentComms.map(c =>
    `- ${c.date} [${c.type}] ${c.subject}${c.sentiment ? ` (${c.sentiment})` : ''}\n  ${c.preview}...`
  ).join('\n\n') : 'No recent communications'}`;

  return {
    contactInfo,
    companyInfo,
    dealsInfo,
    engagementInfo,
    communicationsInfo,
  };
}

/**
 * Get the contact summary prompt from the database or use fallback
 */
async function getContactSummaryPrompt(context: ContactContext): Promise<string> {
  const variables = formatContactContextVariables(context);

  // Try to get prompt from database
  const result = await getPromptWithVariables('contact_summary', variables);

  if (result?.prompt) {
    return result.prompt;
  }

  // Fallback to inline prompt if database prompt not available
  console.warn('[ContactSummary] Using fallback prompt - database prompt not found');
  return `${variables.contactInfo}

${variables.companyInfo}

${variables.dealsInfo}

${variables.engagementInfo}

${variables.communicationsInfo}

---

Analyze this contact and provide a comprehensive JSON summary. Be specific. Infer from the communication patterns and content. Focus on actionable insights for sales.

Respond with a JSON object containing: headline, overview, profile, influence, communication, engagement, keyInsights, painPoints, interests, relationshipTips, and confidence (0-1).`;
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
  const prompt = await getContactSummaryPrompt(context);

  const { data: summary, usage, latencyMs } = await callAIJson<ContactSummary>({
    prompt,
    maxTokens: 1500,
    temperature: 0.3,
  });

  // Ensure required fields exist
  const enrichedSummary: ContactSummary = {
    ...summary,
    keyInsights: summary.keyInsights || [],
    painPoints: summary.painPoints || [],
    interests: summary.interests || [],
    relationshipTips: summary.relationshipTips || [],
    generatedAt: new Date().toISOString(),
  };

  const summaryText = `${enrichedSummary.headline || ''}\n\n${enrichedSummary.overview || ''}`;

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
