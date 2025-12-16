/**
 * Deal Summary Generator
 * Generates AI-powered summaries for deals
 */

import { createClient } from '@/lib/supabase/server';
import { callAIJson, logAIUsage } from '../core/aiClient';
import { createHash } from 'crypto';
import type { DealSummary, GenerateSummaryOptions, SummaryResult } from './types';

// ============================================
// TYPES
// ============================================

interface DealContext {
  deal: {
    id: string;
    name: string;
    stage: string;
    estimated_value: number | null;
    health_score: number | null;
    health_trend: string | null;
    stage_entered_at: string | null;
    close_date: string | null;
    deal_type: string | null;
    sales_team: string | null;
    created_at: string;
    updated_at: string;
  };
  company: {
    id: string;
    name: string;
    status: string;
    segment: string;
    industry: string;
    agent_count: number;
    crm_platform: string | null;
    voice_customer: boolean;
  } | null;
  contacts: Array<{
    id: string;
    name: string;
    title: string | null;
    role: string | null;
    email: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    subject: string | null;
    body: string | null;
    occurred_at: string;
    sentiment: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    due_at: string | null;
    priority: string;
  }>;
}

// ============================================
// CONTEXT GATHERING
// ============================================

async function gatherDealContext(dealId: string, options: GenerateSummaryOptions = {}): Promise<DealContext> {
  const supabase = await createClient();
  const maxActivities = options.maxActivities || 50;

  // Fetch deal with company
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select(`
      id, name, stage, estimated_value, health_score, health_trend,
      stage_entered_at, close_date, deal_type, sales_team,
      created_at, updated_at,
      company:companies(
        id, name, status, segment, industry, agent_count,
        crm_platform, voice_customer
      )
    `)
    .eq('id', dealId)
    .single();

  if (dealError || !deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  // Handle company being array or object (Supabase returns array for relations)
  const companyData = Array.isArray(deal.company) ? deal.company[0] : deal.company;

  // Fetch contacts via company
  let contacts: DealContext['contacts'] = [];
  if (companyData?.id) {
    const { data: companyContacts } = await supabase
      .from('contacts')
      .select('id, name, title, role, email')
      .eq('company_id', companyData.id)
      .order('created_at', { ascending: true });
    contacts = companyContacts || [];
  }

  // Fetch activities
  const { data: activities } = await supabase
    .from('activities')
    .select('id, type, subject, body, occurred_at, sentiment, metadata')
    .eq('deal_id', dealId)
    .order('occurred_at', { ascending: false })
    .limit(maxActivities);

  // Fetch open tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_at, priority')
    .eq('deal_id', dealId)
    .neq('status', 'completed')
    .order('due_at', { ascending: true })
    .limit(10);

  return {
    deal: {
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      estimated_value: deal.estimated_value,
      health_score: deal.health_score,
      health_trend: deal.health_trend,
      stage_entered_at: deal.stage_entered_at,
      close_date: deal.close_date,
      deal_type: deal.deal_type,
      sales_team: deal.sales_team,
      created_at: deal.created_at,
      updated_at: deal.updated_at,
    },
    company: companyData || null,
    contacts,
    activities: activities || [],
    tasks: tasks || [],
  };
}

// ============================================
// HASH GENERATION
// ============================================

function generateContextHash(context: DealContext): string {
  // Create a deterministic hash of the key context elements
  const hashInput = JSON.stringify({
    dealId: context.deal.id,
    stage: context.deal.stage,
    healthScore: context.deal.health_score,
    activityCount: context.activities.length,
    lastActivityDate: context.activities[0]?.occurred_at || null,
    contactCount: context.contacts.length,
    taskCount: context.tasks.length,
    updatedAt: context.deal.updated_at,
  });

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildDealSummaryPrompt(context: DealContext): string {
  const { deal, company, contacts, activities, tasks } = context;

  // Calculate days in stage
  const daysInStage = deal.stage_entered_at
    ? Math.floor((Date.now() - new Date(deal.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Calculate days since last activity
  const lastActivity = activities[0];
  const daysSinceContact = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.occurred_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Format activities for context
  const recentActivities = activities.slice(0, 15).map(a => ({
    date: new Date(a.occurred_at).toLocaleDateString(),
    type: a.type,
    subject: a.subject || 'No subject',
    sentiment: a.sentiment || 'unknown',
  }));

  return `Generate a comprehensive summary for this sales deal.

## Deal Information
- Name: ${deal.name}
- Stage: ${deal.stage}
- Days in Stage: ${daysInStage}
- Estimated Value: ${deal.estimated_value ? `$${deal.estimated_value.toLocaleString()}` : 'Not set'}
- Health Score: ${deal.health_score || 'N/A'}/100
- Health Trend: ${deal.health_trend || 'unknown'}
- Deal Type: ${deal.deal_type || 'new_business'}
- Sales Team: ${deal.sales_team || 'Not assigned'}
- Close Date: ${deal.close_date || 'Not set'}
- Created: ${new Date(deal.created_at).toLocaleDateString()}

## Company
${company ? `
- Name: ${company.name}
- Status: ${company.status}
- Segment: ${company.segment}
- Industry: ${company.industry}
- Agent Count: ${company.agent_count}
- CRM Platform: ${company.crm_platform || 'Unknown'}
- Voice Customer: ${company.voice_customer ? 'Yes' : 'No'}
` : 'No company linked'}

## Contacts (${contacts.length})
${contacts.length > 0 ? contacts.map(c =>
    `- ${c.name}${c.title ? ` (${c.title})` : ''}${c.role ? ` - ${c.role}` : ''}`
  ).join('\n') : 'No contacts linked'}

## Recent Activities (${activities.length} total)
${recentActivities.length > 0 ? recentActivities.map(a =>
    `- ${a.date}: ${a.type} - ${a.subject} [${a.sentiment}]`
  ).join('\n') : 'No activities recorded'}

## Open Tasks
${tasks.length > 0 ? tasks.map(t =>
    `- [${t.priority}] ${t.title} - Due: ${t.due_at ? new Date(t.due_at).toLocaleDateString() : 'No date'}`
  ).join('\n') : 'No open tasks'}

## Key Metrics
- Days Since Last Contact: ${daysSinceContact}
- Total Activities: ${activities.length}
- Contact Count: ${contacts.length}

---

Analyze this deal and provide a comprehensive JSON summary:

{
  "headline": "One compelling sentence summarizing the deal's current state",
  "overview": "2-3 paragraphs providing context on the deal, its history, current status, and what's needed to close it",

  "currentStatus": {
    "stage": "${deal.stage}",
    "daysInStage": ${daysInStage},
    "healthScore": ${deal.health_score || 50},
    "trend": "${deal.health_trend || 'stable'}"
  },

  "keyPoints": [
    {"point": "Important observation about the deal", "importance": "high|medium|low"}
  ],

  "stakeholderStatus": {
    "totalContacts": ${contacts.length},
    "hasDecisionMaker": true|false,
    "hasChampion": true|false,
    "keyPlayers": [
      {"name": "Contact name", "role": "Their role", "sentiment": "positive|neutral|negative|unknown"}
    ]
  },

  "engagement": {
    "lastContactDate": "${lastActivity?.occurred_at || null}",
    "daysSinceContact": ${daysSinceContact},
    "recentActivityCount": ${activities.filter(a => new Date(a.occurred_at) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)).length},
    "communicationPattern": "Description of how communication has been going"
  },

  "risks": ["List of risks or concerns about this deal"],

  "opportunities": ["List of opportunities or positive indicators"],

  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "high|medium|low",
      "reasoning": "Why this action is recommended"
    }
  ],

  "confidence": 0.85
}

Be specific and actionable. Reference actual data from the context. Don't be generic.`;
}

// ============================================
// MAIN GENERATOR
// ============================================

export async function generateDealSummary(
  dealId: string,
  options: GenerateSummaryOptions = {}
): Promise<SummaryResult<DealSummary>> {
  const supabase = await createClient();
  const startTime = Date.now();

  // Gather context
  const context = await gatherDealContext(dealId, options);
  const contextHash = generateContextHash(context);

  // Check for existing summary if not forcing regeneration
  if (!options.force) {
    const { data: existing } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('deal_id', dealId)
      .eq('summary_type', 'deal_overview')
      .single();

    if (existing && !existing.stale && existing.context_hash === contextHash) {
      // Return cached summary
      return {
        summary: existing.summary as DealSummary,
        isNew: false,
        wasStale: false,
        contextHash,
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Generate new summary
  const prompt = buildDealSummaryPrompt(context);

  const { data: summary, usage, latencyMs } = await callAIJson<DealSummary>({
    prompt,
    maxTokens: 2000,
    temperature: 0.3,
  });

  // Add generated timestamp
  const enrichedSummary: DealSummary = {
    ...summary,
    generatedAt: new Date().toISOString(),
  };

  // Generate summary text for search/display
  const summaryText = `${enrichedSummary.headline}\n\n${enrichedSummary.overview}`;

  // Save to database
  const { data: existingRecord } = await supabase
    .from('ai_summaries')
    .select('id')
    .eq('deal_id', dealId)
    .eq('summary_type', 'deal_overview')
    .single();

  if (existingRecord) {
    // Update existing
    await supabase
      .from('ai_summaries')
      .update({
        summary: enrichedSummary,
        summary_text: summaryText,
        key_points: enrichedSummary.keyPoints.map(kp => kp.point),
        risks: enrichedSummary.risks,
        opportunities: enrichedSummary.opportunities,
        generated_at: new Date().toISOString(),
        context_hash: contextHash,
        stale: false,
        model_used: 'claude-sonnet-4-20250514',
        tokens_used: usage.inputTokens + usage.outputTokens,
        confidence: enrichedSummary.confidence,
      })
      .eq('id', existingRecord.id);
  } else {
    // Insert new
    await supabase.from('ai_summaries').insert({
      deal_id: dealId,
      summary_type: 'deal_overview',
      summary: enrichedSummary,
      summary_text: summaryText,
      key_points: enrichedSummary.keyPoints.map(kp => kp.point),
      risks: enrichedSummary.risks,
      opportunities: enrichedSummary.opportunities,
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
    insightType: 'deal_summary',
    dealId,
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

export async function getDealSummary(dealId: string): Promise<DealSummary | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('ai_summaries')
    .select('summary, stale')
    .eq('deal_id', dealId)
    .eq('summary_type', 'deal_overview')
    .single();

  if (!data) return null;

  return data.summary as DealSummary;
}

// ============================================
// STALENESS CHECK
// ============================================

export async function isDealSummaryStale(dealId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('ai_summaries')
    .select('stale, generated_at, context_hash')
    .eq('deal_id', dealId)
    .eq('summary_type', 'deal_overview')
    .single();

  if (!data) return true; // No summary exists

  if (data.stale) return true;

  // Check if older than 24 hours
  const generatedAt = new Date(data.generated_at);
  const hoursSinceGeneration = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceGeneration > 24) return true;

  // Could also check context hash here by regenerating it
  return false;
}
