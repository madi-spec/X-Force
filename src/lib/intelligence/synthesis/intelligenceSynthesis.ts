/**
 * Intelligence Synthesis Service
 * Uses Claude AI to analyze collected data and generate actionable insights
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson, logAIUsage } from '@/lib/ai/core/aiClient';
import { getPromptWithVariables } from '@/lib/ai/promptManager';
import { createHash } from 'crypto';
import type {
  AccountIntelligence,
  IntelligenceSource,
  IntelligenceSynthesis,
  EnhancedIntelligenceSynthesis,
  PainPoint,
  Opportunity,
  TalkingPoint,
  WebsiteData,
  EnhancedWebsiteData,
  FacebookData,
  GoogleReviewsData,
  EnhancedGoogleReviewsData,
  ApolloCompanyData,
  ApolloPeopleData,
  IndustryMentionsData,
  MarketingActivityData,
  EmployeeMediaData,
  EnhancedApolloPerson,
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
        const data = source.processed_data as unknown as EnhancedWebsiteData;
        contextText += `## Website Data\n`;
        if (data.title) contextText += `- Title: ${data.title}\n`;
        if (data.description) contextText += `- Description: ${data.description}\n`;
        if (data.tagline) contextText += `- Tagline: ${data.tagline}\n`;
        if (data.aboutText) contextText += `- About: ${data.aboutText.substring(0, 1000)}\n`;
        if (data.services.length > 0) contextText += `- Services: ${data.services.join(', ')}\n`;
        if (data.products.length > 0) contextText += `- Products: ${data.products.join(', ')}\n`;

        // Enhanced website data
        if (data.serviceDetails && data.serviceDetails.length > 0) {
          contextText += `- Service Details:\n`;
          data.serviceDetails.slice(0, 8).forEach((s) => {
            contextText += `  - ${s.name}${s.isPrimary ? ' (Primary)' : ''}`;
            if (s.description) contextText += `: ${s.description.substring(0, 100)}`;
            if (s.pricingHint) contextText += ` [${s.pricingHint}]`;
            contextText += '\n';
          });
        }
        if (data.serviceAreas && data.serviceAreas.length > 0) {
          contextText += `- Service Areas: ${data.serviceAreas.slice(0, 15).join(', ')}\n`;
        }
        if (data.certifications && data.certifications.length > 0) {
          contextText += `- Certifications: ${data.certifications.join(', ')}\n`;
        }
        if (data.awards && data.awards.length > 0) {
          contextText += `- Awards: ${data.awards.slice(0, 5).join(', ')}\n`;
        }
        if (data.employeeSizeIndicators) {
          const esi = data.employeeSizeIndicators;
          contextText += `- Employee Size Indicators:\n`;
          if (esi.teamPageCount > 0) contextText += `  - Team page shows ${esi.teamPageCount} members\n`;
          if (esi.careersPageExists) contextText += `  - Has careers page\n`;
          if (esi.jobPostingsCount > 0) contextText += `  - ${esi.jobPostingsCount} open positions\n`;
          if (esi.locationsCount > 0) contextText += `  - ${esi.locationsCount} locations\n`;
        }
        if (data.schedulingSystem) contextText += `- Scheduling: ${data.schedulingSystem}\n`;
        if (data.paymentMethods && data.paymentMethods.length > 0) {
          contextText += `- Payment Methods: ${data.paymentMethods.join(', ')}\n`;
        }
        if (data.blogPostFrequency && data.blogPostFrequency !== 'none') {
          contextText += `- Blog Frequency: ${data.blogPostFrequency}\n`;
        }
        if (data.contentTopics && data.contentTopics.length > 0) {
          contextText += `- Content Topics: ${data.contentTopics.slice(0, 10).join(', ')}\n`;
        }

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
        if (data.caseStudies && data.caseStudies.length > 0) {
          contextText += `- Case Studies:\n`;
          data.caseStudies.slice(0, 3).forEach((c) => {
            contextText += `  - ${c.title}${c.results ? `: ${c.results.substring(0, 100)}` : ''}\n`;
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
        const data = source.processed_data as unknown as EnhancedGoogleReviewsData;
        contextText += `## Google Reviews\n`;
        if (data.rating) contextText += `- Rating: ${data.rating}/5 (${data.totalReviews} reviews)\n`;
        if (data.address) contextText += `- Address: ${data.address}\n`;
        if (data.types.length > 0) contextText += `- Business Types: ${data.types.join(', ')}\n`;

        // Enhanced review analysis
        if (data.ratingTrend) {
          contextText += `- Rating Trend: ${data.ratingTrend}`;
          if (data.recentRating && data.historicalRating) {
            contextText += ` (Recent: ${data.recentRating}, Historical: ${data.historicalRating})`;
          }
          contextText += '\n';
        }
        if (data.ownerResponseRate > 0) {
          contextText += `- Owner Response Rate: ${Math.round(data.ownerResponseRate * 100)}%\n`;
        }
        if (data.mostPraisedAspects && data.mostPraisedAspects.length > 0) {
          contextText += `- Most Praised: ${data.mostPraisedAspects.join(', ')}\n`;
        }
        if (data.mostCriticizedAspects && data.mostCriticizedAspects.length > 0) {
          contextText += `- Most Criticized: ${data.mostCriticizedAspects.join(', ')}\n`;
        }
        if (data.competitorMentions && data.competitorMentions.length > 0) {
          contextText += `- Competitor Mentions: ${data.competitorMentions.join(', ')}\n`;
        }

        // Pain point analysis with actual quotes
        if (data.painPointAnalysis) {
          const ppa = data.painPointAnalysis;
          const hasPainPoints = Object.values(ppa).some((p) => p.count > 0);
          if (hasPainPoints) {
            contextText += `- PAIN POINT ANALYSIS FROM REVIEWS:\n`;
            if (ppa.waitTimes.count > 0) {
              contextText += `  - Wait Times (${ppa.waitTimes.count} mentions):\n`;
              ppa.waitTimes.quotes.slice(0, 2).forEach((q) => {
                contextText += `    - "${q}"\n`;
              });
            }
            if (ppa.communication.count > 0) {
              contextText += `  - Communication Issues (${ppa.communication.count} mentions):\n`;
              ppa.communication.quotes.slice(0, 2).forEach((q) => {
                contextText += `    - "${q}"\n`;
              });
            }
            if (ppa.pricing.count > 0) {
              contextText += `  - Pricing Concerns (${ppa.pricing.count} mentions):\n`;
              ppa.pricing.quotes.slice(0, 2).forEach((q) => {
                contextText += `    - "${q}"\n`;
              });
            }
            if (ppa.quality.count > 0) {
              contextText += `  - Quality Issues (${ppa.quality.count} mentions):\n`;
              ppa.quality.quotes.slice(0, 2).forEach((q) => {
                contextText += `    - "${q}"\n`;
              });
            }
            if (ppa.scheduling.count > 0) {
              contextText += `  - Scheduling Problems (${ppa.scheduling.count} mentions):\n`;
              ppa.scheduling.quotes.slice(0, 2).forEach((q) => {
                contextText += `    - "${q}"\n`;
              });
            }
            if (ppa.staffIssues.count > 0) {
              contextText += `  - Staff Issues (${ppa.staffIssues.count} mentions):\n`;
              ppa.staffIssues.quotes.slice(0, 2).forEach((q) => {
                contextText += `    - "${q}"\n`;
              });
            }
          }
        }

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
        const people = data.people as unknown as EnhancedApolloPerson[];
        contextText += `## Key People (LinkedIn/Apollo)\n`;
        contextText += `- Total found: ${data.totalResults}\n`;

        // Count decision makers and tech buyers
        const decisionMakers = people.filter((p) =>
          ['c_level', 'owner', 'partner', 'vp', 'director'].includes(p.seniority || '')
        );
        const withEmail = people.filter((p) => p.email);
        const withPhone = people.filter((p) => p.phone || p.directDial || p.mobilePhone);

        contextText += `- Decision Makers: ${decisionMakers.length}\n`;
        contextText += `- With Email: ${withEmail.length}\n`;
        contextText += `- With Phone: ${withPhone.length}\n`;

        if (people.length > 0) {
          contextText += `- Key Contacts:\n`;
          people.slice(0, 20).forEach((p) => {
            contextText += `  - ${p.fullName}`;
            if (p.title) contextText += ` - ${p.title}`;
            if (p.seniority) contextText += ` (${p.seniority})`;
            if (p.department) contextText += ` [${p.department}]`;
            // Add contact availability indicators
            const hasContact = [];
            if (p.email) hasContact.push('email');
            if (p.directDial) hasContact.push('direct');
            if (p.mobilePhone) hasContact.push('mobile');
            if (p.linkedinUrl) hasContact.push('linkedin');
            if (hasContact.length > 0) contextText += ` {${hasContact.join(', ')}}`;
            // Add decision signals
            const signals = [];
            if (p.budgetAuthority) signals.push('budget authority');
            if (p.techBuyer) signals.push('tech buyer');
            if (p.yearsAtCompany && p.yearsAtCompany > 3) signals.push(`${p.yearsAtCompany}+ yrs`);
            if (signals.length > 0) contextText += ` [${signals.join(', ')}]`;
            contextText += '\n';
          });
        }
        contextText += '\n';
        break;
      }

      case 'marketing_activity': {
        const data = source.processed_data as unknown as MarketingActivityData;
        contextText += `## Marketing Activity Assessment\n`;
        contextText += `- Marketing Maturity: ${data.marketingMaturity}\n`;
        if (data.primaryChannels.length > 0) {
          contextText += `- Primary Channels: ${data.primaryChannels.join(', ')}\n`;
        }
        contextText += `- Facebook Posts (30d): ${data.facebook.postsLast30Days}\n`;
        if (data.facebook.avgEngagementRate > 0) {
          contextText += `- FB Engagement Rate: ${(data.facebook.avgEngagementRate * 100).toFixed(2)}%\n`;
        }
        contextText += `- LinkedIn Posts (30d): ${data.linkedin.postsLast30Days}\n`;
        contextText += `- Blog Posts (90d): ${data.blog.postsLast90Days}\n`;
        if (data.blog.topics.length > 0) {
          contextText += `- Blog Topics: ${data.blog.topics.slice(0, 5).join(', ')}\n`;
        }
        contextText += `- Content Strategy: ${data.contentStrategy}\n`;
        contextText += '\n';
        break;
      }

      case 'employee_media': {
        const data = source.processed_data as unknown as EmployeeMediaData;
        contextText += `## Employee Media Presence\n`;
        contextText += `- Total Media Mentions: ${data.totalMediaMentions}\n`;
        contextText += `- Employees with Presence: ${data.employeesWithPresence}\n`;
        if (data.thoughtLeaders.length > 0) {
          contextText += `- Thought Leaders: ${data.thoughtLeaders.join(', ')}\n`;
        }
        if (data.employeeProfiles.length > 0) {
          contextText += `- Employee Profiles:\n`;
          data.employeeProfiles
            .filter((p) => p.visibilityScore > 0)
            .slice(0, 5)
            .forEach((p) => {
              contextText += `  - ${p.name} (Score: ${p.visibilityScore})\n`;
              if (p.podcastAppearances.length > 0) {
                contextText += `    - Podcasts: ${p.podcastAppearances.map((m) => m.title).slice(0, 2).join(', ')}\n`;
              }
              if (p.speakingEvents.length > 0) {
                contextText += `    - Speaking: ${p.speakingEvents.map((m) => m.title).slice(0, 2).join(', ')}\n`;
              }
              if (p.newsArticles.length > 0) {
                contextText += `    - News: ${p.newsArticles.map((m) => m.title).slice(0, 2).join(', ')}\n`;
              }
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
7. What are the top 5 prioritized recommendations for engaging this prospect?
8. What connection points can we use to build rapport (shared interests, community involvement, background)?
9. What objections might they raise and how should we respond?
10. What competitive signals or current providers can we identify?

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
  "confidence": 0-1,
  "recommendations": [
    {
      "title": "Short actionable title",
      "description": "Why this matters based on evidence",
      "action": "Specific action to take or script to use",
      "priority": 1,
      "confidence": "high|medium|low",
      "category": "outreach|messaging|timing|stakeholder|product",
      "source": "What data supports this"
    }
  ],
  "connectionPoints": [
    {
      "type": "shared_interest|mutual_connection|common_background|local_community|industry_event",
      "point": "The connection point",
      "context": "How we found this",
      "useCase": "How to use this in conversation",
      "source": "Data source"
    }
  ],
  "objectionPrep": [
    {
      "objection": "The anticipated objection",
      "likelihood": "high|medium|low",
      "response": "How to respond effectively",
      "evidence": "Data supporting our response",
      "source": "Where we learned this"
    }
  ],
  "signalsTimeline": [
    {
      "date": "YYYY-MM-DD or approximate date",
      "type": "news|hire|growth|funding|review|social|award",
      "title": "Brief title",
      "description": "What happened",
      "sentiment": "positive|neutral|negative",
      "source": "Where found",
      "url": "Optional URL"
    }
  ],
  "competitiveIntel": {
    "currentProviders": ["List of detected current vendors/providers"],
    "switchingSignals": ["Signs they might be looking to switch"],
    "competitorMentions": [
      {
        "competitor": "Competitor name",
        "context": "How they were mentioned",
        "sentiment": "positive|neutral|negative"
      }
    ]
  },
  "companyProfile": {
    "sizeTier": "startup|smb|mid_market|enterprise",
    "employeeEstimate": null or number,
    "operationalMaturity": "Description of operational sophistication",
    "serviceModel": "single_location|multi_location|franchise|mobile_only",
    "techAdoption": "legacy|mixed|modern|cutting_edge",
    "yearsInBusiness": null or number
  },
  "reviewPainPoints": [
    {
      "category": "wait_times|communication|pricing|quality|scheduling|staff",
      "severity": "high|medium|low",
      "frequency": number of mentions,
      "quotes": ["Actual customer quotes"],
      "implication": "What this means for our sales approach"
    }
  ],
  "marketingProfile": {
    "maturityLevel": "sophisticated|active|basic|minimal",
    "primaryChannels": ["Facebook", "LinkedIn", "Blog"],
    "contentStrategy": "Assessment of their marketing approach",
    "digitalPresence": 0-100,
    "recommendation": "Marketing-focused or operations-focused approach"
  },
  "visibleEmployees": [
    {
      "name": "Employee name",
      "title": "Their title",
      "visibilityScore": 0-100,
      "mediaAppearances": number,
      "linkedinActive": true|false,
      "connectionOpportunity": "How to use this for connection"
    }
  ],
  "productsServices": [
    {
      "name": "Service name",
      "description": "Brief description",
      "isPrimary": true|false
    }
  ],
  "serviceAreas": ["List of geographic areas served"],
  "certifications": ["QualityPro", "NPMA", etc.]
}

IMPORTANT GUIDELINES:
- Provide exactly 5 recommendations, prioritized 1-5 (1 = highest priority)
- For recommendations, include specific talking points or scripts in the "action" field
- Find at least 2-3 connection points for rapport building (community involvement, hobbies, background)
- Anticipate 3-5 likely objections based on company profile
- Create a chronological signals timeline from all dated events found
- Be specific and reference actual data from the intelligence report
- Focus on insights that help close a sale

ADDITIONAL DEEP ANALYSIS:
- Assess company size tier based on employee indicators, job postings, and locations
- Extract pain points from Google review quotes - use actual customer words
- Evaluate marketing maturity and recommend approach accordingly
- Identify visible employees for relationship-building opportunities
- List all products/services with primary designations
- Include all service areas and certifications found`;
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

  // Build context text for the prompt
  const fallbackPrompt = buildSynthesisPrompt({
    companyId,
    companyName,
    sources: validSources,
  });

  // Define fallback schema for JSON response
  const fallbackSchema = `{
    "executiveSummary": "string",
    "painPoints": [{"pain": "string", "evidence": "string", "severity": "high|medium|low", "source": "string"}],
    "opportunities": [{"opportunity": "string", "approach": "string", "confidence": "high|medium|low", "source": "string"}],
    "talkingPoints": [{"topic": "string", "angle": "string", "source": "string", "useCase": "string"}],
    "recommendedApproach": "string",
    "scores": {"overall": 0-100, "website": 0-100, "social": 0-100, "review": 0-100, "industry": 0-100},
    "confidence": 0-1,
    "recommendations": [{"title": "string", "description": "string", "action": "string", "priority": 1-5, "confidence": "high|medium|low", "category": "string", "source": "string"}],
    "connectionPoints": [{"type": "string", "point": "string", "context": "string", "useCase": "string", "source": "string"}],
    "objectionPrep": [{"objection": "string", "likelihood": "high|medium|low", "response": "string", "evidence": "string", "source": "string"}],
    "signalsTimeline": [{"date": "string", "type": "string", "title": "string", "description": "string", "sentiment": "string", "source": "string", "url": "string"}],
    "competitiveIntel": {"currentProviders": [], "switchingSignals": [], "competitorMentions": []},
    "companyProfile": {"sizeTier": "string", "employeeEstimate": null, "operationalMaturity": "string", "serviceModel": "string", "techAdoption": "string", "yearsInBusiness": null},
    "reviewPainPoints": [],
    "marketingProfile": {"maturityLevel": "string", "primaryChannels": [], "contentStrategy": "string", "digitalPresence": 0-100, "recommendation": "string"},
    "visibleEmployees": [],
    "productsServices": [],
    "serviceAreas": [],
    "certifications": []
  }`;

  let synthesis: EnhancedIntelligenceSynthesis;
  let usage: { inputTokens: number; outputTokens: number };
  let latencyMs: number;

  // TODO: Create 'intelligence_synthesis' prompt in ai_prompts table via /settings/ai-prompts
  // Variables: companyName, intelligenceContext (the full context text from sources)
  const promptResult = await getPromptWithVariables('intelligence_synthesis', {
    companyName,
    intelligenceContext: fallbackPrompt, // Pass the full built context
  });

  if (promptResult?.prompt) {
    const result = await callAIJson<EnhancedIntelligenceSynthesis>({
      prompt: promptResult.prompt,
      schema: promptResult.schema || fallbackSchema,
      maxTokens: promptResult.maxTokens || 8000,
      temperature: 0.3,
      model: (promptResult.model as 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514') || 'claude-sonnet-4-20250514',
    });
    synthesis = result.data;
    usage = result.usage;
    latencyMs = result.latencyMs;
  } else {
    // Fallback to hardcoded prompt if no managed prompt exists
    console.warn('[IntelligenceSynthesis] No managed prompt found for intelligence_synthesis, using fallback');
    const result = await callAIJson<EnhancedIntelligenceSynthesis>({
      prompt: fallbackPrompt,
      maxTokens: 8000,
      temperature: 0.3,
    });
    synthesis = result.data;
    usage = result.usage;
    latencyMs = result.latencyMs;
  }

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

  const enrichedSynthesis: EnhancedIntelligenceSynthesis = {
    ...synthesis,
    scores: finalScores,
    painPoints: synthesis.painPoints || [],
    opportunities: synthesis.opportunities || [],
    talkingPoints: synthesis.talkingPoints || [],
    // Enhanced fields
    recommendations: synthesis.recommendations || [],
    connectionPoints: synthesis.connectionPoints || [],
    objectionPrep: synthesis.objectionPrep || [],
    signalsTimeline: synthesis.signalsTimeline || [],
    competitiveIntel: synthesis.competitiveIntel || {
      currentProviders: [],
      switchingSignals: [],
      competitorMentions: [],
    },
    // Deep intelligence fields
    companyProfile: synthesis.companyProfile || {
      sizeTier: 'smb',
      employeeEstimate: null,
      operationalMaturity: 'Unknown',
      serviceModel: 'single_location',
      techAdoption: 'mixed',
      yearsInBusiness: null,
    },
    reviewPainPoints: synthesis.reviewPainPoints || [],
    marketingProfile: synthesis.marketingProfile || {
      maturityLevel: 'Unknown',
      primaryChannels: [],
      contentStrategy: '',
      digitalPresence: 0,
      recommendation: '',
    },
    visibleEmployees: synthesis.visibleEmployees || [],
    productsServices: synthesis.productsServices || [],
    serviceAreas: synthesis.serviceAreas || [],
    certifications: synthesis.certifications || [],
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
  synthesis: IntelligenceSynthesis | EnhancedIntelligenceSynthesis,
  contextHash: string
): Promise<AccountIntelligence> {
  const supabase = createAdminClient();

  // Cast to enhanced to access deep intelligence fields
  const enhanced = synthesis as EnhancedIntelligenceSynthesis;

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
    // Enhanced fields
    recommendations: synthesis.recommendations,
    connection_points: synthesis.connectionPoints,
    objection_prep: synthesis.objectionPrep,
    signals_timeline: synthesis.signalsTimeline,
    competitive_intel: synthesis.competitiveIntel,
    // Deep intelligence fields
    company_profile: enhanced.companyProfile || null,
    review_pain_points: enhanced.reviewPainPoints || [],
    marketing_profile: enhanced.marketingProfile || null,
    visible_employees: enhanced.visibleEmployees || [],
    products_services: enhanced.productsServices || [],
    service_areas: enhanced.serviceAreas || [],
    certifications: enhanced.certifications || [],
    // Metadata
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

  // Try to save with all fields first, fall back to core fields if deep intelligence columns don't exist
  const saveData = async (data: typeof intelligenceData, includeDeepFields: boolean) => {
    const savePayload = includeDeepFields ? data : {
      company_id: data.company_id,
      overall_score: data.overall_score,
      website_score: data.website_score,
      social_score: data.social_score,
      review_score: data.review_score,
      industry_score: data.industry_score,
      executive_summary: data.executive_summary,
      pain_points: data.pain_points,
      opportunities: data.opportunities,
      talking_points: data.talking_points,
      recommended_approach: data.recommended_approach,
      recommendations: data.recommendations,
      connection_points: data.connection_points,
      objection_prep: data.objection_prep,
      signals_timeline: data.signals_timeline,
      competitive_intel: data.competitive_intel,
      last_collected_at: data.last_collected_at,
      collection_status: data.collection_status,
      context_hash: data.context_hash,
      error_message: data.error_message,
      updated_at: data.updated_at,
    };

    if (existing) {
      const { data: result, error } = await supabase
        .from('account_intelligence')
        .update(savePayload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return result as AccountIntelligence;
    } else {
      const { data: result, error } = await supabase
        .from('account_intelligence')
        .insert(savePayload)
        .select()
        .single();
      if (error) throw error;
      return result as AccountIntelligence;
    }
  };

  try {
    // Try saving with all deep intelligence fields
    intelligence = await saveData(intelligenceData, true);
  } catch (fullError) {
    // If that fails (likely missing columns), try without deep fields
    console.warn('[SaveIntelligence] Full save failed, trying without deep intelligence fields:', fullError);
    try {
      intelligence = await saveData(intelligenceData, false);
    } catch (coreError) {
      // If even core save fails, rethrow
      throw coreError;
    }
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
