/**
 * Intelligence Synthesis Service
 * Uses Claude AI to analyze collected data and generate actionable insights
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson, logAIUsage } from '@/lib/ai/core/aiClient';
import { createHash } from 'crypto';
import type {
  AccountIntelligence,
  IntelligenceSource,
  IntelligenceSynthesis,
  PainPoint,
  Opportunity,
  TalkingPoint,
  WebsiteData,
  FacebookData,
  GoogleReviewsData,
  ApolloCompanyData,
  ApolloPeopleData,
  IndustryMentionsData,
} from '../types';

// ============================================
// TYPES
// ============================================

interface SynthesisContext {
  companyId: string;
  companyName: string;
  sources: IntelligenceSource[];
}

interface SynthesisResult {
  synthesis: IntelligenceSynthesis;
  contextHash: string;
  tokensUsed: number;
  latencyMs: number;
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildSynthesisPrompt(context: SynthesisContext): string {
  const { companyName, sources } = context;

  let contextText = `# Company Intelligence Report: ${companyName}\n\n`;

  // Process each source
  for (const source of sources) {
    if (!source.processed_data) continue;

    switch (source.source_type) {
      case 'website': {
        const data = source.processed_data as unknown as WebsiteData;
        contextText += `## Website Data\n`;
        if (data.title) contextText += `- Title: ${data.title}\n`;
        if (data.description) contextText += `- Description: ${data.description}\n`;
        if (data.tagline) contextText += `- Tagline: ${data.tagline}\n`;
        if (data.aboutText) contextText += `- About: ${data.aboutText.substring(0, 1000)}\n`;
        if (data.services.length > 0) contextText += `- Services: ${data.services.join(', ')}\n`;
        if (data.products.length > 0) contextText += `- Products: ${data.products.join(', ')}\n`;
        if (data.teamMembers.length > 0) {
          contextText += `- Key Team Members:\n`;
          data.teamMembers.slice(0, 10).forEach((m) => {
            contextText += `  - ${m.name}${m.title ? ` (${m.title})` : ''}\n`;
          });
        }
        if (data.testimonials.length > 0) {
          contextText += `- Testimonials:\n`;
          data.testimonials.slice(0, 3).forEach((t) => {
            contextText += `  - "${t.substring(0, 200)}"\n`;
          });
        }
        if (data.blogPosts.length > 0) {
          contextText += `- Recent Blog Posts:\n`;
          data.blogPosts.slice(0, 5).forEach((p) => {
            contextText += `  - ${p.title}\n`;
          });
        }
        contextText += '\n';
        break;
      }

      case 'facebook': {
        const data = source.processed_data as unknown as FacebookData;
        contextText += `## Facebook Presence\n`;
        if (data.pageName) contextText += `- Page: ${data.pageName}\n`;
        if (data.category) contextText += `- Category: ${data.category}\n`;
        if (data.followers) contextText += `- Followers: ${data.followers.toLocaleString()}\n`;
        if (data.rating) contextText += `- Rating: ${data.rating}/5\n`;
        if (data.description) contextText += `- Description: ${data.description.substring(0, 500)}\n`;
        if (data.recentPosts.length > 0) {
          contextText += `- Recent Posts:\n`;
          data.recentPosts.slice(0, 3).forEach((p) => {
            contextText += `  - "${p.content.substring(0, 150)}"\n`;
          });
        }
        contextText += '\n';
        break;
      }

      case 'google_reviews': {
        const data = source.processed_data as unknown as GoogleReviewsData;
        contextText += `## Google Reviews\n`;
        if (data.rating) contextText += `- Rating: ${data.rating}/5 (${data.totalReviews} reviews)\n`;
        if (data.address) contextText += `- Address: ${data.address}\n`;
        if (data.types.length > 0) contextText += `- Business Types: ${data.types.join(', ')}\n`;
        if (data.reviews.length > 0) {
          contextText += `- Sample Reviews:\n`;
          data.reviews.slice(0, 5).forEach((r) => {
            contextText += `  - ${r.rating}/5: "${r.text.substring(0, 200)}"\n`;
          });
        }
        contextText += '\n';
        break;
      }

      case 'linkedin_company': {
        const data = source.processed_data as unknown as ApolloCompanyData;
        contextText += `## LinkedIn Company Profile\n`;
        if (data.description) contextText += `- Description: ${data.description.substring(0, 500)}\n`;
        if (data.industry) contextText += `- Industry: ${data.industry}\n`;
        if (data.employeeCount) contextText += `- Employees: ${data.employeeCount.toLocaleString()}\n`;
        if (data.revenueRange) contextText += `- Revenue: ${data.revenueRange}\n`;
        if (data.headquarters) {
          const hq = data.headquarters;
          contextText += `- Headquarters: ${[hq.city, hq.state, hq.country].filter(Boolean).join(', ')}\n`;
        }
        if (data.foundedYear) contextText += `- Founded: ${data.foundedYear}\n`;
        if (data.technologies.length > 0) contextText += `- Technologies: ${data.technologies.slice(0, 10).join(', ')}\n`;
        if (data.keywords.length > 0) contextText += `- Keywords: ${data.keywords.slice(0, 10).join(', ')}\n`;
        contextText += '\n';
        break;
      }

      case 'linkedin_people': {
        const data = source.processed_data as unknown as ApolloPeopleData;
        contextText += `## Key People (LinkedIn)\n`;
        contextText += `- Total found: ${data.totalResults}\n`;
        if (data.people.length > 0) {
          contextText += `- Key Contacts:\n`;
          data.people.slice(0, 15).forEach((p) => {
            contextText += `  - ${p.fullName}`;
            if (p.title) contextText += ` - ${p.title}`;
            if (p.seniority) contextText += ` (${p.seniority})`;
            contextText += '\n';
          });
        }
        contextText += '\n';
        break;
      }

      case 'industry_mentions': {
        const data = source.processed_data as unknown as IndustryMentionsData;
        contextText += `## Industry Mentions & News\n`;
        contextText += `- Total Mentions: ${data.totalMentions}\n`;
        contextText += `- Sentiment: ${data.positiveCount} positive, ${data.neutralCount} neutral, ${data.negativeCount} negative\n`;
        if (data.mentions.length > 0) {
          contextText += `- Recent Mentions:\n`;
          data.mentions.slice(0, 10).forEach((m) => {
            contextText += `  - [${m.sentiment}] ${m.title} (${m.source})\n`;
            if (m.snippet) contextText += `    "${m.snippet.substring(0, 150)}"\n`;
          });
        }
        contextText += '\n';
        break;
      }
    }
  }

  // Build the full prompt
  return `${contextText}

---

You are an expert sales intelligence analyst for X-RAI, a company selling phone systems and AI solutions to pest control and lawn care companies.

Analyze this intelligence data about "${companyName}" and provide a comprehensive sales intelligence report.

Consider:
1. What can we learn about this company's size, maturity, and operations?
2. What pain points might they have that our solutions could address?
3. What are the best opportunities to approach them?
4. Who are the key decision makers we should target?
5. What talking points would resonate with them?
6. What is the overall readiness of this account for sales engagement?

Respond with a JSON object containing:
{
  "executiveSummary": "2-3 paragraph executive overview of the company and sales opportunity",
  "painPoints": [
    {
      "pain": "The specific pain point",
      "evidence": "What data supports this",
      "severity": "high|medium|low",
      "source": "website|reviews|linkedin|news"
    }
  ],
  "opportunities": [
    {
      "opportunity": "The sales opportunity",
      "approach": "How to leverage this",
      "confidence": "high|medium|low",
      "source": "What data supports this"
    }
  ],
  "talkingPoints": [
    {
      "topic": "The topic to discuss",
      "angle": "How to position it",
      "source": "What makes this relevant",
      "useCase": "When to use this point"
    }
  ],
  "recommendedApproach": "1-2 paragraphs on the best sales approach for this account",
  "scores": {
    "overall": 0-100,
    "website": 0-100,
    "social": 0-100,
    "review": 0-100,
    "industry": 0-100
  },
  "confidence": 0-1
}

Be specific and actionable. Reference actual data from the intelligence report. Focus on insights that help close a sale.`;
}

// ============================================
// HASH GENERATION
// ============================================

function generateContextHash(sources: IntelligenceSource[]): string {
  const hashInput = sources
    .map((s) => `${s.source_type}:${s.collected_at}:${s.quality_score}`)
    .sort()
    .join('|');

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

// ============================================
// SCORE CALCULATION
// ============================================

function calculateScores(sources: IntelligenceSource[]): {
  website: number;
  social: number;
  review: number;
  industry: number;
} {
  const scores = {
    website: 0,
    social: 0,
    review: 0,
    industry: 0,
  };

  for (const source of sources) {
    switch (source.source_type) {
      case 'website':
        scores.website = source.quality_score || 0;
        break;
      case 'facebook':
        scores.social = Math.max(scores.social, source.quality_score || 0);
        break;
      case 'linkedin_company':
      case 'linkedin_people':
        scores.social = Math.max(scores.social, source.quality_score || 0);
        break;
      case 'google_reviews':
        scores.review = source.quality_score || 0;
        break;
      case 'industry_mentions':
        scores.industry = source.quality_score || 0;
        break;
    }
  }

  return scores;
}

// ============================================
// MAIN SYNTHESIS
// ============================================

/**
 * Synthesize intelligence from all sources
 */
export async function synthesizeIntelligence(
  companyId: string,
  companyName: string,
  sources: IntelligenceSource[]
): Promise<SynthesisResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  // Filter to successful sources with data
  const validSources = sources.filter(
    (s) => s.processed_data && !s.error_message
  );

  if (validSources.length === 0) {
    throw new Error('No valid source data to synthesize');
  }

  const contextHash = generateContextHash(validSources);
  const sourceScores = calculateScores(validSources);

  // Build and send prompt
  const prompt = buildSynthesisPrompt({
    companyId,
    companyName,
    sources: validSources,
  });

  const { data: synthesis, usage, latencyMs } = await callAIJson<IntelligenceSynthesis>({
    prompt,
    maxTokens: 3000,
    temperature: 0.3,
  });

  // Merge calculated scores with AI scores (prefer calculated for data quality)
  const finalScores = {
    overall: synthesis.scores?.overall || Math.round(
      (sourceScores.website + sourceScores.social + sourceScores.review + sourceScores.industry) / 4
    ),
    website: sourceScores.website || synthesis.scores?.website || 0,
    social: sourceScores.social || synthesis.scores?.social || 0,
    review: sourceScores.review || synthesis.scores?.review || 0,
    industry: sourceScores.industry || synthesis.scores?.industry || 0,
  };

  const enrichedSynthesis: IntelligenceSynthesis = {
    ...synthesis,
    scores: finalScores,
    painPoints: synthesis.painPoints || [],
    opportunities: synthesis.opportunities || [],
    talkingPoints: synthesis.talkingPoints || [],
  };

  // Log AI usage
  await logAIUsage(supabase, {
    insightType: 'intelligence_synthesis',
    companyId,
    usage,
    latencyMs,
    model: 'claude-sonnet-4-20250514',
    data: { contextHash, sourceCount: validSources.length },
  });

  return {
    synthesis: enrichedSynthesis,
    contextHash,
    tokensUsed: usage.inputTokens + usage.outputTokens,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Save synthesis results to account_intelligence table
 */
export async function saveIntelligence(
  companyId: string,
  synthesis: IntelligenceSynthesis,
  contextHash: string
): Promise<AccountIntelligence> {
  const supabase = createAdminClient();

  const intelligenceData = {
    company_id: companyId,
    overall_score: synthesis.scores.overall,
    website_score: synthesis.scores.website,
    social_score: synthesis.scores.social,
    review_score: synthesis.scores.review,
    industry_score: synthesis.scores.industry,
    executive_summary: synthesis.executiveSummary,
    pain_points: synthesis.painPoints,
    opportunities: synthesis.opportunities,
    talking_points: synthesis.talkingPoints,
    recommended_approach: synthesis.recommendedApproach,
    last_collected_at: new Date().toISOString(),
    collection_status: 'complete',
    context_hash: contextHash,
    error_message: null,
    updated_at: new Date().toISOString(),
  };

  // Upsert (update if exists, insert if not)
  const { data: existing } = await supabase
    .from('account_intelligence')
    .select('id')
    .eq('company_id', companyId)
    .single();

  let intelligence: AccountIntelligence;

  if (existing) {
    const { data, error } = await supabase
      .from('account_intelligence')
      .update(intelligenceData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    intelligence = data as AccountIntelligence;
  } else {
    const { data, error } = await supabase
      .from('account_intelligence')
      .insert(intelligenceData)
      .select()
      .single();

    if (error) throw error;
    intelligence = data as AccountIntelligence;
  }

  return intelligence;
}

/**
 * Get existing intelligence for a company
 */
export async function getIntelligence(
  companyId: string
): Promise<AccountIntelligence | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('account_intelligence')
    .select('*')
    .eq('company_id', companyId)
    .single();

  return data as AccountIntelligence | null;
}

/**
 * Check if intelligence is stale
 */
export async function isIntelligenceStale(companyId: string): Promise<boolean> {
  const intelligence = await getIntelligence(companyId);

  if (!intelligence) return true;
  if (intelligence.collection_status === 'failed') return true;

  // Intelligence is stale after 7 days
  if (intelligence.last_collected_at) {
    const lastCollected = new Date(intelligence.last_collected_at);
    const daysSince = (Date.now() - lastCollected.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  }

  return true;
}
