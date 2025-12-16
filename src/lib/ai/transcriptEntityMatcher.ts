/**
 * AI-powered entity matching for meeting transcripts
 * Analyzes transcript content to determine company, deal, and pipeline assignment
 */

import { callAIJson, logAIUsage } from './core/aiClient';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPrompt } from './promptManager';

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
  // New fields for entity creation
  extractedEntityData?: ExtractedEntityData;
}

export interface ExtractedEntityData {
  company: {
    name: string;
    industry: 'pest' | 'lawn' | 'both' | null;
    segment: 'smb' | 'mid_market' | 'enterprise' | 'pe_platform' | 'franchisor' | null;
    estimatedAgentCount: number | null;
    crmPlatform: 'fieldroutes' | 'pestpac' | 'realgreen' | null;
    website: string | null;
    city: string | null;
    state: string | null;
  };
  contacts: Array<{
    name: string;
    email: string | null;
    title: string | null;
    role: 'decision_maker' | 'influencer' | 'champion' | 'end_user' | null;
    isPrimary: boolean;
  }>;
  deal: {
    suggestedName: string;
    estimatedValue: number | null;
    productInterests: string[];
    salesTeam: 'voice_outside' | 'voice_inside' | 'xrai' | null;
    notes: string | null;
  };
  confidence: number;
}

export interface EntityCreationResult {
  companyId: string;
  companyName: string;
  contactIds: string[];
  dealId: string | null;
  dealName: string | null;
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

  // Default schema for entity matching (used as fallback)
  const defaultEntityMatchingSchema = `{
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

  // Try to get the prompt from the database
  const dbPromptData = await getPrompt('entity_matching');

  let prompt: string;
  let schema: string;

  if (dbPromptData) {
    // Replace variables in the template
    prompt = dbPromptData.prompt_template
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{participantList\}\}/g, participantList || 'No participants listed')
      .replace(/\{\{truncatedTranscript\}\}/g, truncatedTranscript)
      .replace(/\{\{companyList\}\}/g, companyList || 'No companies found')
      .replace(/\{\{dealList\}\}/g, dealList || 'No active deals found')
      .replace(/\{\{contactList\}\}/g, contactList || 'No contacts found');
    schema = dbPromptData.schema_template || defaultEntityMatchingSchema;
  } else {
    // Fallback to hardcoded prompt
    prompt = `You are analyzing a sales meeting transcript to determine which company and deal it should be associated with in our CRM.

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
    schema = defaultEntityMatchingSchema;
  }

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

/**
 * Extract detailed entity data from transcript for creating new records
 */
export async function extractEntityDataFromTranscript(
  transcriptText: string,
  title: string,
  participants: Array<{ name: string; email?: string }>,
  userId: string
): Promise<ExtractedEntityData | null> {
  const supabase = createAdminClient();

  // Truncate transcript if too long
  const maxTranscriptLength = 12000;
  const truncatedTranscript = transcriptText.length > maxTranscriptLength
    ? transcriptText.slice(0, maxTranscriptLength) + '\n\n[... transcript truncated ...]'
    : transcriptText;

  const participantList = participants
    .map((p) => `- ${p.name}${p.email ? ` (${p.email})` : ''}`)
    .join('\n');

  // Default schema for entity extraction (used as fallback)
  const defaultEntityExtractionSchema = `{
  "company": {
    "name": "Company name (required - extract from conversation or email domain)",
    "industry": "pest|lawn|both|null",
    "segment": "smb|mid_market|enterprise|pe_platform|franchisor|null (smb=1-5 agents, mid_market=6-20, enterprise=21-100, pe_platform=100+)",
    "estimatedAgentCount": number or null,
    "crmPlatform": "fieldroutes|pestpac|realgreen|null (if mentioned)",
    "website": "company website if mentioned or null",
    "city": "city if mentioned or null",
    "state": "2-letter state code if mentioned or null"
  },
  "contacts": [
    {
      "name": "Person's full name",
      "email": "email if available or null",
      "title": "Job title if mentioned or null",
      "role": "decision_maker|influencer|champion|end_user|null",
      "isPrimary": true/false (mark the main contact as primary)
    }
  ],
  "deal": {
    "suggestedName": "Suggested deal name (usually company name)",
    "estimatedValue": number or null (based on company size and products discussed),
    "productInterests": ["Voice", "X-RAI", "AI Agents"] (which products were discussed),
    "salesTeam": "voice_outside|voice_inside|xrai|null",
    "notes": "Key notes about the opportunity"
  },
  "confidence": 0.0-1.0 (how confident are you in this extracted data)
}

Important:
- Always extract a company name - use email domain if no explicit name
- Include all participants as contacts
- Set isPrimary=true for the main point of contact
- Estimate deal value based on: SMB $5-15K, Mid-Market $15-50K, Enterprise $50-150K
- Set salesTeam based on primary product interest (Voice products = voice teams, X-RAI/AI = xrai)`;

  // Try to get the prompt from the database
  const dbPromptData = await getPrompt('entity_extraction');

  let prompt: string;
  let schema: string;

  if (dbPromptData) {
    // Replace variables in the template
    prompt = dbPromptData.prompt_template
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{participantList\}\}/g, participantList || 'No participants listed')
      .replace(/\{\{truncatedTranscript\}\}/g, truncatedTranscript);
    schema = dbPromptData.schema_template || defaultEntityExtractionSchema;
  } else {
    // Fallback to hardcoded prompt
    prompt = `You are analyzing a sales meeting transcript to extract information for creating new CRM records.

## Context
This is for X-RAI Labs, which sells:
- Voice phone systems for pest control and lawn care companies
- X-RAI platform (call analytics, performance tracking)
- AI Agents (receptionist, dispatch, sales bots)

## Meeting Title
${title}

## Meeting Participants
${participantList || 'No participants listed'}

## Transcript
${truncatedTranscript}

---

Extract detailed information to create a new company, contacts, and deal in the CRM.

Look for:
- Company name (from conversation or email domains like @pestcompany.com)
- Industry (pest control, lawn care, or both)
- Company size hints (number of technicians, trucks, locations, call volume)
- People's names, titles, and roles
- Products being discussed or demoed
- Budget or value hints
- Location information

Respond with JSON:`;
    schema = defaultEntityExtractionSchema;
  }

  try {
    const { data, usage, latencyMs } = await callAIJson<ExtractedEntityData>({
      prompt,
      schema,
      maxTokens: 2000,
    });

    // Log AI usage
    await logAIUsage(supabase, {
      insightType: 'transcript_entity_extraction',
      userId,
      usage,
      latencyMs,
      model: 'claude-sonnet-4-20250514',
      data: {
        transcriptTitle: title,
        extractedCompany: data.company?.name,
        contactCount: data.contacts?.length,
        confidence: data.confidence,
      },
    });

    return data;
  } catch (error) {
    console.error('[Entity Extraction] Error:', error);
    return null;
  }
}

/**
 * Create company, contacts, and deal from extracted transcript data
 */
export async function createEntitiesFromTranscript(
  extractedData: ExtractedEntityData,
  userId: string,
  transcriptionId?: string
): Promise<EntityCreationResult | null> {
  const supabase = createAdminClient();

  console.log('[Entity Creation] Creating entities from transcript data...');

  try {
    // 1. Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: extractedData.company.name,
        status: 'prospect',
        industry: extractedData.company.industry || 'pest',
        segment: extractedData.company.segment || 'smb',
        agent_count: extractedData.company.estimatedAgentCount || 0,
        crm_platform: extractedData.company.crmPlatform,
        address: extractedData.company.city || extractedData.company.state ? {
          street: '',
          city: extractedData.company.city || '',
          state: extractedData.company.state || '',
          zip: '',
        } : null,
      })
      .select('id, name')
      .single();

    if (companyError) {
      console.error('[Entity Creation] Failed to create company:', companyError);
      throw new Error(`Failed to create company: ${companyError.message}`);
    }

    console.log('[Entity Creation] Created company:', company.name, company.id);

    // 2. Create contacts
    const contactIds: string[] = [];
    for (const contact of extractedData.contacts) {
      if (!contact.name) continue;

      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_id: company.id,
          name: contact.name,
          email: contact.email,
          title: contact.title,
          role: contact.role || 'influencer',
          is_primary: contact.isPrimary,
        })
        .select('id')
        .single();

      if (contactError) {
        console.warn('[Entity Creation] Failed to create contact:', contact.name, contactError.message);
        continue;
      }

      contactIds.push(newContact.id);
      console.log('[Entity Creation] Created contact:', contact.name);
    }

    // 3. Create deal
    let dealId: string | null = null;
    let dealName: string | null = null;

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        company_id: company.id,
        owner_id: userId,
        name: extractedData.deal.suggestedName || company.name,
        stage: 'new_lead',
        deal_type: 'new_business',
        sales_team: extractedData.deal.salesTeam || 'voice_inside',
        estimated_value: extractedData.deal.estimatedValue || 10000,
        quoted_products: extractedData.deal.productInterests || [],
      })
      .select('id, name')
      .single();

    if (dealError) {
      console.warn('[Entity Creation] Failed to create deal:', dealError.message);
    } else {
      dealId = deal.id;
      dealName = deal.name;
      console.log('[Entity Creation] Created deal:', deal.name, deal.id);

      // 4. Create initial activity noting the transcript
      await supabase.from('activities').insert({
        deal_id: deal.id,
        company_id: company.id,
        user_id: userId,
        type: 'meeting_held',
        subject: 'Initial meeting (from Fireflies transcript)',
        body: extractedData.deal.notes || 'Meeting imported from Fireflies transcript.',
        occurred_at: new Date().toISOString(),
      });
    }

    return {
      companyId: company.id,
      companyName: company.name,
      contactIds,
      dealId,
      dealName,
    };
  } catch (error) {
    console.error('[Entity Creation] Error:', error);
    return null;
  }
}

/**
 * Find similar companies by name (fuzzy matching)
 */
async function findSimilarCompanies(
  companyName: string,
  limit: number = 5
): Promise<Array<{ id: string; name: string; status: string; similarity: string }>> {
  const supabase = createAdminClient();

  // Get all companies and do simple similarity matching
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, status, segment, industry')
    .limit(500);

  if (!companies) return [];

  const searchTerms = companyName.toLowerCase().split(/\s+/);

  const matches = companies
    .map((c) => {
      const nameLower = c.name.toLowerCase();
      // Check for word matches
      const matchedTerms = searchTerms.filter(
        (term) => nameLower.includes(term) || term.includes(nameLower.split(/\s+/)[0])
      );
      const similarity = matchedTerms.length / searchTerms.length;
      return { ...c, similarity, matchedTerms: matchedTerms.length };
    })
    .filter((c) => c.matchedTerms > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      similarity: `${(c.similarity * 100).toFixed(0)}%`,
    }));

  return matches;
}

/**
 * Create a review task for unmatched transcript with extracted data and suggestions
 * This allows human to either match to existing entities OR create new ones
 */
export async function createEntityReviewTask(
  transcriptionId: string,
  transcriptionTitle: string,
  extractedData: ExtractedEntityData,
  aiMatchResult: AIEntityMatchResult | null,
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Find similar existing companies
  const similarCompanies = await findSimilarCompanies(extractedData.company.name);

  const descriptionParts = [
    `Meeting transcript "${transcriptionTitle}" could not be automatically matched to existing records.`,
    '',
    '═══════════════════════════════════════════',
    '📋 EXTRACTED INFORMATION FROM TRANSCRIPT',
    '═══════════════════════════════════════════',
    '',
    '**Company:**',
    `  Name: ${extractedData.company.name}`,
    `  Industry: ${extractedData.company.industry || 'Unknown'}`,
    `  Segment: ${extractedData.company.segment || 'Unknown'}`,
    `  Est. Agents: ${extractedData.company.estimatedAgentCount || 'Unknown'}`,
    extractedData.company.crmPlatform ? `  CRM: ${extractedData.company.crmPlatform}` : '',
    '',
    '**Contacts:**',
  ];

  // Add contacts
  if (extractedData.contacts?.length > 0) {
    extractedData.contacts.forEach((c, i) => {
      descriptionParts.push(`  ${i + 1}. ${c.name}${c.email ? ` <${c.email}>` : ''}`);
      if (c.title) descriptionParts.push(`     Title: ${c.title}`);
      if (c.role) descriptionParts.push(`     Role: ${c.role}`);
    });
  } else {
    descriptionParts.push('  (No contacts extracted)');
  }

  descriptionParts.push('');
  descriptionParts.push('**Deal Info:**');
  descriptionParts.push(`  Products: ${extractedData.deal.productInterests?.join(', ') || 'Unknown'}`);
  descriptionParts.push(`  Est. Value: ${extractedData.deal.estimatedValue ? `$${extractedData.deal.estimatedValue.toLocaleString()}` : 'Unknown'}`);
  descriptionParts.push(`  Sales Team: ${extractedData.deal.salesTeam || 'Unknown'}`);
  if (extractedData.deal.notes) {
    descriptionParts.push(`  Notes: ${extractedData.deal.notes}`);
  }

  descriptionParts.push('');
  descriptionParts.push(`**AI Confidence:** ${(extractedData.confidence * 100).toFixed(0)}%`);

  // Add similar companies section
  if (similarCompanies.length > 0) {
    descriptionParts.push('');
    descriptionParts.push('═══════════════════════════════════════════');
    descriptionParts.push('🔍 SIMILAR EXISTING COMPANIES');
    descriptionParts.push('═══════════════════════════════════════════');
    descriptionParts.push('');
    similarCompanies.forEach((c, i) => {
      descriptionParts.push(`  ${i + 1}. ${c.name} (${c.status}) - ${c.similarity} match`);
    });
    descriptionParts.push('');
    descriptionParts.push('⚠️  Check if this is an existing company before creating new records!');
  }

  descriptionParts.push('');
  descriptionParts.push('═══════════════════════════════════════════');
  descriptionParts.push('✅ ACTION REQUIRED');
  descriptionParts.push('═══════════════════════════════════════════');
  descriptionParts.push('');
  descriptionParts.push('**Option A - Match to Existing:**');
  descriptionParts.push('  1. Find the correct company in the system');
  descriptionParts.push('  2. Edit the transcript and assign to that company/deal');
  descriptionParts.push('  3. Add any new contacts if needed');
  descriptionParts.push('');
  descriptionParts.push('**Option B - Create New Records:**');
  descriptionParts.push('  1. Create a new company with the info above');
  descriptionParts.push('  2. Add the contacts');
  descriptionParts.push('  3. Create a new deal');
  descriptionParts.push('  4. Assign the transcript to the new deal');
  descriptionParts.push('');
  descriptionParts.push(`**Transcription ID:** ${transcriptionId}`);

  if (aiMatchResult?.reasoning) {
    descriptionParts.push('');
    descriptionParts.push('**AI Reasoning:** ' + aiMatchResult.reasoning);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2); // 2 days to review

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      assigned_to: userId,
      type: 'review',
      title: `Assign transcript: ${extractedData.company.name} - ${transcriptionTitle}`,
      description: descriptionParts.filter(Boolean).join('\n'),
      priority: 'high',
      due_at: dueDate.toISOString(),
      source: 'fireflies_ai',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Entity Review] Failed to create review task:', error);
    return null;
  }

  return data?.id || null;
}
