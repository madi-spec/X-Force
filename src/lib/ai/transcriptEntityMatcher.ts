/**
 * AI-powered entity matching for meeting transcripts
 * Analyzes transcript content to determine company, deal, and pipeline assignment
 */

import { callAIJson, logAIUsage } from './core/aiClient';
import { createAdminClient } from '@/lib/supabase/admin';

export interface EntityMatchCandidate {
  id: string;
  name: string;
  matchScore: number;
  matchReasons: string[];
}

export interface AIEntityMatchResult {
  companyMatch: EntityMatchCandidate | null;
  dealMatch: EntityMatchCandidate | null;
  suggestedSalesTeam: 'voice_outside' | 'voice_inside' | 'xrai' | null;
  overallConfidence: number;
  reasoning: string;
  extractedCompanyName: string | null;
  extractedPersonNames: string[];
  extractedTopics: string[];
  requiresHumanReview: boolean;
  reviewReason: string | null;
}

interface CompanyForMatching {
  id: string;
  name: string;
  status: string;
  segment: string;
  industry: string;
}

interface DealForMatching {
  id: string;
  name: string;
  stage: string;
  company_id: string;
  company_name: string;
  sales_team: string | null;
}

interface ContactForMatching {
  id: string;
  name: string;
  email: string | null;
  company_id: string;
  company_name: string;
}

/**
 * Use AI to match a transcript to companies and deals
 */
export async function aiMatchTranscriptToEntities(
  transcriptText: string,
  title: string,
  participants: Array<{ name: string; email?: string }>,
  userId: string
): Promise<AIEntityMatchResult> {
  const supabase = createAdminClient();

  // Fetch all companies, deals, and contacts for context
  const [companiesResult, dealsResult, contactsResult] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, status, segment, industry')
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('deals')
      .select(`
        id,
        name,
        stage,
        company_id,
        sales_team,
        company:companies(name)
      `)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('contacts')
      .select(`
        id,
        name,
        email,
        company_id,
        company:companies(name)
      `)
      .order('updated_at', { ascending: false })
      .limit(1000),
  ]);

  const companies: CompanyForMatching[] = companiesResult.data || [];
  const deals: DealForMatching[] = (dealsResult.data || []).map((d) => {
    const company = Array.isArray(d.company) ? d.company[0] : d.company;
    return {
      id: d.id,
      name: d.name,
      stage: d.stage,
      company_id: d.company_id,
      company_name: company?.name || 'Unknown',
      sales_team: d.sales_team,
    };
  });
  const contacts: ContactForMatching[] = (contactsResult.data || []).map((c) => {
    const company = Array.isArray(c.company) ? c.company[0] : c.company;
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      company_id: c.company_id,
      company_name: company?.name || 'Unknown',
    };
  });

  // Build company list for the prompt
  const companyList = companies
    .map((c) => `- ${c.name} (ID: ${c.id}, Status: ${c.status}, Segment: ${c.segment})`)
    .join('\n');

  // Build deal list for the prompt
  const dealList = deals
    .map((d) => `- ${d.name} at ${d.company_name} (ID: ${d.id}, Stage: ${d.stage}, Team: ${d.sales_team || 'unassigned'})`)
    .join('\n');

  // Build contact list for the prompt
  const contactList = contacts
    .slice(0, 200) // Limit to avoid token overflow
    .map((c) => `- ${c.name} (${c.email || 'no email'}) at ${c.company_name}`)
    .join('\n');

  // Build participant list
  const participantList = participants
    .map((p) => `- ${p.name}${p.email ? ` (${p.email})` : ''}`)
    .join('\n');

  // Truncate transcript if too long
  const maxTranscriptLength = 15000;
  const truncatedTranscript = transcriptText.length > maxTranscriptLength
    ? transcriptText.slice(0, maxTranscriptLength) + '\n\n[... transcript truncated for analysis ...]'
    : transcriptText;

  const prompt = `You are analyzing a sales meeting transcript to determine which company and deal it should be associated with in our CRM.

## Meeting Title
${title}

## Meeting Participants
${participantList || 'No participants listed'}

## Transcript
${truncatedTranscript}

## Available Companies in CRM
${companyList || 'No companies found'}

## Active Deals in CRM
${dealList || 'No active deals found'}

## Known Contacts
${contactList || 'No contacts found'}

---

Analyze the transcript and determine:
1. Which company (if any) this meeting is about
2. Which deal (if any) this meeting should be associated with
3. Which sales team should handle this (voice_outside, voice_inside, or xrai)
4. Whether a human needs to review and manually assign this transcript

Look for:
- Company names mentioned in the conversation
- People's names that match known contacts
- Discussion topics that relate to specific deals
- Industry context (pest control, lawn care)
- Product discussions (Voice, X-RAI, AI Agents)

Respond with JSON:`;

  const schema = `{
  "companyMatch": {
    "id": "UUID of matched company or null",
    "name": "Company name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this company was matched"]
  } | null,
  "dealMatch": {
    "id": "UUID of matched deal or null",
    "name": "Deal name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this deal was matched"]
  } | null,
  "suggestedSalesTeam": "voice_outside|voice_inside|xrai|null",
  "overallConfidence": 0.0-1.0,
  "reasoning": "Explanation of the matching logic",
  "extractedCompanyName": "Company name mentioned in transcript (even if not in CRM)",
  "extractedPersonNames": ["Names of people mentioned"],
  "extractedTopics": ["Key topics discussed"],
  "requiresHumanReview": true/false,
  "reviewReason": "Why human review is needed or null"
}

Important:
- Set requiresHumanReview=true if confidence < 0.6 or if there are multiple possible matches
- Set requiresHumanReview=true if a company is mentioned but doesn't exist in the CRM
- Only match to a deal if you're confident it's the right one
- If the transcript mentions a company not in our CRM, set extractedCompanyName but companyMatch to null`;

  const startTime = Date.now();

  try {
    const { data, usage, latencyMs } = await callAIJson<AIEntityMatchResult>({
      prompt,
      schema,
      maxTokens: 2000,
    });

    // Log AI usage
    await logAIUsage(supabase, {
      insightType: 'transcript_entity_match',
      userId,
      usage,
      latencyMs,
      model: 'claude-sonnet-4-20250514',
      data: {
        transcriptTitle: title,
        matchedCompanyId: data.companyMatch?.id,
        matchedDealId: data.dealMatch?.id,
        confidence: data.overallConfidence,
      },
    });

    // Validate the matched IDs actually exist
    if (data.companyMatch?.id) {
      const validCompany = companies.find((c) => c.id === data.companyMatch?.id);
      if (!validCompany) {
        console.warn('[AI Entity Match] AI returned invalid company ID:', data.companyMatch.id);
        data.companyMatch = null;
        data.requiresHumanReview = true;
        data.reviewReason = 'AI suggested a company that could not be verified';
      }
    }

    if (data.dealMatch?.id) {
      const validDeal = deals.find((d) => d.id === data.dealMatch?.id);
      if (!validDeal) {
        console.warn('[AI Entity Match] AI returned invalid deal ID:', data.dealMatch.id);
        data.dealMatch = null;
        data.requiresHumanReview = true;
        data.reviewReason = 'AI suggested a deal that could not be verified';
      }
    }

    return data;
  } catch (error) {
    console.error('[AI Entity Match] Error:', error);

    // Return a result requiring human review
    return {
      companyMatch: null,
      dealMatch: null,
      suggestedSalesTeam: null,
      overallConfidence: 0,
      reasoning: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      extractedCompanyName: null,
      extractedPersonNames: participants.map((p) => p.name),
      extractedTopics: [],
      requiresHumanReview: true,
      reviewReason: 'AI analysis failed - manual review required',
    };
  }
}

/**
 * Create a task for human review of transcript assignment
 */
export async function createTranscriptReviewTask(
  transcriptionId: string,
  transcriptionTitle: string,
  aiMatchResult: AIEntityMatchResult,
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Build task description
  const descriptionParts = [
    `A meeting transcript "${transcriptionTitle}" needs manual review to determine which company and/or deal it should be assigned to.`,
    '',
    '**AI Analysis:**',
    aiMatchResult.reasoning,
  ];

  if (aiMatchResult.extractedCompanyName) {
    descriptionParts.push(`\n**Mentioned Company:** ${aiMatchResult.extractedCompanyName}`);
  }

  if (aiMatchResult.extractedPersonNames.length > 0) {
    descriptionParts.push(`\n**People Mentioned:** ${aiMatchResult.extractedPersonNames.join(', ')}`);
  }

  if (aiMatchResult.extractedTopics.length > 0) {
    descriptionParts.push(`\n**Topics Discussed:** ${aiMatchResult.extractedTopics.join(', ')}`);
  }

  if (aiMatchResult.reviewReason) {
    descriptionParts.push(`\n**Review Reason:** ${aiMatchResult.reviewReason}`);
  }

  descriptionParts.push(`\n\n**Transcription ID:** ${transcriptionId}`);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2); // 2 days to review

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      deal_id: aiMatchResult.dealMatch?.id || null,
      company_id: aiMatchResult.companyMatch?.id || null,
      assigned_to: userId,
      created_by: null, // System created
      type: 'review',
      title: `Review transcript assignment: ${transcriptionTitle}`,
      description: descriptionParts.join('\n'),
      priority: 'medium',
      due_at: dueDate.toISOString(),
      source: 'fireflies_ai',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[AI Entity Match] Failed to create review task:', error);
    return null;
  }

  return data?.id || null;
}
