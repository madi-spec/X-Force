/**
 * Company Summary Generator
 * Generates AI-powered summaries for companies
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson, logAIUsage } from '../core/aiClient';
import { createHash } from 'crypto';
import type { CompanySummary, GenerateSummaryOptions, SummaryResult } from './types';

// ============================================
// TYPES
// ============================================

interface CompanyContext {
  company: {
    id: string;
    name: string;
    status: string;
    segment: string;
    industry: string;
    agent_count: number;
    crm_platform: string | null;
    voice_customer: boolean;
    voice_customer_since: string | null;
    created_at: string;
    updated_at: string;
  };
  contacts: Array<{
    id: string;
    name: string;
    title: string | null;
    role: string | null;
    email: string | null;
  }>;
  deals: Array<{
    id: string;
    name: string;
    stage: string;
    estimated_value: number | null;
    health_score: number | null;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    subject: string | null;
    occurred_at: string;
    sentiment: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    status: string;
    mrr: number | null;
  }>;
}

// ============================================
// CONTEXT GATHERING
// ============================================

async function gatherCompanyContext(companyId: string, options: GenerateSummaryOptions = {}): Promise<CompanyContext> {
  const supabase = createAdminClient();
  const maxActivities = options.maxActivities || 50;

  // Fetch company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Fetch contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, title, role, email')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  // Fetch deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage, estimated_value, health_score, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  // Fetch activities
  const { data: activities } = await supabase
    .from('activities')
    .select('id, type, subject, occurred_at, sentiment')
    .eq('company_id', companyId)
    .order('occurred_at', { ascending: false })
    .limit(maxActivities);

  // Fetch company products
  const { data: companyProducts } = await supabase
    .from('company_products')
    .select(`
      id, status, mrr,
      product:products(name)
    `)
    .eq('company_id', companyId)
    .eq('status', 'active');

  const products = (companyProducts || []).map(cp => {
    const product = cp.product as { name: string } | { name: string }[] | null;
    const productName = Array.isArray(product) ? product[0]?.name : product?.name;
    return {
      id: cp.id,
      name: productName || 'Unknown',
      status: cp.status,
      mrr: cp.mrr,
    };
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      status: company.status,
      segment: company.segment,
      industry: company.industry,
      agent_count: company.agent_count,
      crm_platform: company.crm_platform,
      voice_customer: company.voice_customer,
      voice_customer_since: company.voice_customer_since,
      created_at: company.created_at,
      updated_at: company.updated_at,
    },
    contacts: contacts || [],
    deals: deals || [],
    activities: activities || [],
    products,
  };
}

// ============================================
// HASH GENERATION
// ============================================

function generateContextHash(context: CompanyContext): string {
  const hashInput = JSON.stringify({
    companyId: context.company.id,
    status: context.company.status,
    contactCount: context.contacts.length,
    dealCount: context.deals.length,
    activityCount: context.activities.length,
    lastActivityDate: context.activities[0]?.occurred_at || null,
    productCount: context.products.length,
    updatedAt: context.company.updated_at,
  });

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildCompanySummaryPrompt(context: CompanyContext): string {
  const { company, contacts, deals, activities, products } = context;

  // Calculate metrics
  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const wonDeals = deals.filter(d => d.stage === 'closed_won');
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + (d.estimated_value || 0), 0);
  const closedWonValue = wonDeals.reduce((sum, d) => sum + (d.estimated_value || 0), 0);

  // Deal stages breakdown
  const dealStages: Record<string, number> = {};
  deals.forEach(d => {
    dealStages[d.stage] = (dealStages[d.stage] || 0) + 1;
  });

  // Last activity
  const lastActivity = activities[0];
  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.occurred_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Activity types breakdown
  const activityTypes: Record<string, number> = {};
  activities.forEach(a => {
    activityTypes[a.type] = (activityTypes[a.type] || 0) + 1;
  });

  // Calculate tenure if customer
  let tenure = null;
  if (company.voice_customer && company.voice_customer_since) {
    const months = Math.floor(
      (Date.now() - new Date(company.voice_customer_since).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    tenure = months > 12 ? `${Math.floor(months / 12)} years` : `${months} months`;
  }

  // Total MRR
  const totalMRR = products.reduce((sum, p) => sum + (p.mrr || 0), 0);

  return `Generate a comprehensive summary for this company.

## Company Information
- Name: ${company.name}
- Status: ${company.status}
- Segment: ${company.segment}
- Industry: ${company.industry}
- Agent Count: ${company.agent_count}
- CRM Platform: ${company.crm_platform || 'Unknown'}
- Voice Customer: ${company.voice_customer ? 'Yes' : 'No'}
${company.voice_customer_since ? `- Customer Since: ${new Date(company.voice_customer_since).toLocaleDateString()}` : ''}
${tenure ? `- Customer Tenure: ${tenure}` : ''}
- In CRM Since: ${new Date(company.created_at).toLocaleDateString()}

## Current Products (${products.length})
${products.length > 0 ? products.map(p =>
    `- ${p.name} (${p.status})${p.mrr ? ` - $${p.mrr}/mo` : ''}`
  ).join('\n') : 'No active products'}
${totalMRR > 0 ? `\nTotal MRR: $${totalMRR.toLocaleString()}` : ''}

## Contacts (${contacts.length})
${contacts.length > 0 ? contacts.slice(0, 10).map(c =>
    `- ${c.name}${c.title ? ` - ${c.title}` : ''}${c.role ? ` (${c.role})` : ''}`
  ).join('\n') : 'No contacts'}

## Deals Summary
- Total Deals: ${deals.length}
- Active Deals: ${activeDeals.length}
- Closed Won: ${wonDeals.length}
- Pipeline Value: $${totalPipelineValue.toLocaleString()}
- Closed Won Value: $${closedWonValue.toLocaleString()}
${Object.keys(dealStages).length > 0 ? `\nDeal Stages:\n${Object.entries(dealStages).map(([stage, count]) => `  - ${stage}: ${count}`).join('\n')}` : ''}

## Engagement History
- Total Activities: ${activities.length}
- Days Since Last Activity: ${daysSinceActivity}
${Object.keys(activityTypes).length > 0 ? `\nActivity Types:\n${Object.entries(activityTypes).map(([type, count]) => `  - ${type}: ${count}`).join('\n')}` : ''}

## Recent Activities (last 10)
${activities.slice(0, 10).map(a =>
    `- ${new Date(a.occurred_at).toLocaleDateString()}: ${a.type} - ${a.subject || 'No subject'}`
  ).join('\n') || 'No activities'}

---

Analyze this company and provide a comprehensive JSON summary:

{
  "headline": "One compelling sentence summarizing the company relationship",
  "overview": "2-3 paragraphs about the company, relationship history, and current state",

  "profile": {
    "status": "${company.status}",
    "segment": "${company.segment}",
    "industry": "${company.industry}",
    "size": "${company.agent_count} agents",
    "crmPlatform": ${company.crm_platform ? `"${company.crm_platform}"` : 'null'},
    "isVoiceCustomer": ${company.voice_customer}
  },

  "relationship": {
    "tenure": ${tenure ? `"${tenure}"` : 'null'},
    "currentProducts": ${JSON.stringify(products.map(p => p.name))},
    "totalRevenue": ${totalMRR > 0 ? totalMRR * 12 : 'null'},
    "healthStatus": "healthy|at_risk|churned|prospect"
  },

  "keyContacts": [
    {
      "name": "Contact name",
      "title": "Title or null",
      "role": "Role or null",
      "isPrimary": true|false
    }
  ],

  "dealsSummary": {
    "activeDeals": ${activeDeals.length},
    "totalPipelineValue": ${totalPipelineValue},
    "closedWonValue": ${closedWonValue},
    "dealStages": ${JSON.stringify(dealStages)}
  },

  "engagement": {
    "totalActivities": ${activities.length},
    "lastActivityDate": "${lastActivity?.occurred_at || null}",
    "activityTrend": "increasing|stable|decreasing",
    "primaryChannels": ["email", "meeting", "call"]
  },

  "opportunities": ["List expansion or upsell opportunities"],

  "risks": ["List any concerns or churn risks"],

  "recommendedActions": [
    {
      "action": "Specific next step",
      "priority": "high|medium|low",
      "reasoning": "Why this action"
    }
  ],

  "confidence": 0.85
}

Be specific. Reference actual data. Focus on actionable insights.`;
}

// ============================================
// MAIN GENERATOR
// ============================================

export async function generateCompanySummary(
  companyId: string,
  options: GenerateSummaryOptions = {}
): Promise<SummaryResult<CompanySummary>> {
  const supabase = createAdminClient();
  const startTime = Date.now();

  // Gather context
  const context = await gatherCompanyContext(companyId, options);
  const contextHash = generateContextHash(context);

  // Check for existing summary if not forcing regeneration
  if (!options.force) {
    const { data: existing } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('company_id', companyId)
      .eq('summary_type', 'company_overview')
      .single();

    if (existing && !existing.stale && existing.context_hash === contextHash) {
      return {
        summary: existing.summary as CompanySummary,
        isNew: false,
        wasStale: false,
        contextHash,
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Generate new summary
  const prompt = buildCompanySummaryPrompt(context);

  const { data: summary, usage, latencyMs } = await callAIJson<CompanySummary>({
    prompt,
    maxTokens: 2000,
    temperature: 0.3,
  });

  const enrichedSummary: CompanySummary = {
    ...summary,
    generatedAt: new Date().toISOString(),
  };

  const summaryText = `${enrichedSummary.headline}\n\n${enrichedSummary.overview}`;

  // Save to database
  const { data: existingRecord } = await supabase
    .from('ai_summaries')
    .select('id')
    .eq('company_id', companyId)
    .eq('summary_type', 'company_overview')
    .single();

  if (existingRecord) {
    await supabase
      .from('ai_summaries')
      .update({
        summary: enrichedSummary,
        summary_text: summaryText,
        key_points: enrichedSummary.opportunities,
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
    await supabase.from('ai_summaries').insert({
      company_id: companyId,
      summary_type: 'company_overview',
      summary: enrichedSummary,
      summary_text: summaryText,
      key_points: enrichedSummary.opportunities,
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
    insightType: 'company_summary',
    companyId,
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

export async function getCompanySummary(companyId: string): Promise<CompanySummary | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('ai_summaries')
    .select('summary')
    .eq('company_id', companyId)
    .eq('summary_type', 'company_overview')
    .single();

  if (!data) return null;

  return data.summary as CompanySummary;
}

// ============================================
// STALENESS CHECK
// ============================================

export async function isCompanySummaryStale(companyId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('ai_summaries')
    .select('stale, generated_at')
    .eq('company_id', companyId)
    .eq('summary_type', 'company_overview')
    .single();

  if (!data) return true;
  if (data.stale) return true;

  const generatedAt = new Date(data.generated_at);
  const hoursSinceGeneration = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceGeneration > 48; // Companies can be cached longer
}
