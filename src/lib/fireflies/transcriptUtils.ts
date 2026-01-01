/**
 * Transcript Review Utilities
 *
 * Utility functions for creating review tasks and entities from transcript data.
 * These are workflow helpers used when transcripts need human review.
 *
 * Migrated from transcriptEntityMatcher.ts - entity matching now uses
 * intelligentEntityMatch from @/lib/intelligence/entityMatcher
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson, logAIUsage } from '@/lib/ai/core/aiClient';
import { getPrompt } from '@/lib/ai/promptManager';

// ============================================
// TYPES
// ============================================

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

export interface TranscriptMatchResult {
  companyId: string | null;
  companyName: string | null;
  dealId: string | null;
  confidence: number;
  reasoning: string;
  requiresHumanReview: boolean;
  reviewReason: string | null;
  extractedCompanyName: string | null;
  extractedPersonNames: string[];
}

// ============================================
// TASK CREATION
// ============================================

/**
 * Create a task for human review of transcript assignment
 */
export async function createTranscriptReviewTask(
  transcriptionId: string,
  transcriptionTitle: string,
  matchResult: TranscriptMatchResult,
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Build task description
  const descriptionParts = [
    `A meeting transcript "${transcriptionTitle}" needs manual review to determine which company and/or deal it should be assigned to.`,
    '',
    '**AI Analysis:**',
    matchResult.reasoning,
  ];

  if (matchResult.extractedCompanyName) {
    descriptionParts.push(`\n**Mentioned Company:** ${matchResult.extractedCompanyName}`);
  }

  if (matchResult.extractedPersonNames.length > 0) {
    descriptionParts.push(`\n**People Mentioned:** ${matchResult.extractedPersonNames.join(', ')}`);
  }

  if (matchResult.reviewReason) {
    descriptionParts.push(`\n**Review Reason:** ${matchResult.reviewReason}`);
  }

  descriptionParts.push(`\n\n**Transcription ID:** ${transcriptionId}`);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2); // 2 days to review

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      deal_id: matchResult.dealId || null,
      company_id: matchResult.companyId || null,
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
    console.error('[TranscriptUtils] Failed to create review task:', error);
    return null;
  }

  return data?.id || null;
}

// ============================================
// ENTITY DATA EXTRACTION
// ============================================

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

  // Default schema for entity extraction
  const defaultEntityExtractionSchema = `{
  "company": {
    "name": "Company name (required - extract from conversation or email domain)",
    "industry": "pest|lawn|both|null",
    "segment": "smb|mid_market|enterprise|pe_platform|franchisor|null",
    "estimatedAgentCount": "number or null",
    "crmPlatform": "fieldroutes|pestpac|realgreen|null",
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
      "isPrimary": "true/false"
    }
  ],
  "deal": {
    "suggestedName": "Suggested deal name",
    "estimatedValue": "number or null",
    "productInterests": ["Voice", "X-RAI", "AI Agents"],
    "salesTeam": "voice_outside|voice_inside|xrai|null",
    "notes": "Key notes about the opportunity"
  },
  "confidence": "0.0-1.0"
}`;

  // Try to get the prompt from the database
  const dbPromptData = await getPrompt('entity_extraction');

  let prompt: string;
  let schema: string;

  if (dbPromptData) {
    prompt = dbPromptData.prompt_template
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{participantList\}\}/g, participantList || 'No participants listed')
      .replace(/\{\{truncatedTranscript\}\}/g, truncatedTranscript);
    schema = dbPromptData.schema_template || defaultEntityExtractionSchema;
  } else {
    prompt = `You are analyzing a sales meeting transcript to extract information for creating new CRM records.

## Meeting Title
${title}

## Meeting Participants
${participantList || 'No participants listed'}

## Transcript
${truncatedTranscript}

---

Extract detailed information to create a new company, contacts, and deal in the CRM.
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
    console.error('[TranscriptUtils] Entity extraction error:', error);
    return null;
  }
}

// ============================================
// ENTITY CREATION
// ============================================

/**
 * Create company, contacts, and deal from extracted transcript data
 */
export async function createEntitiesFromTranscript(
  extractedData: ExtractedEntityData,
  userId: string,
  transcriptionId?: string
): Promise<EntityCreationResult | null> {
  const supabase = createAdminClient();

  console.log('[TranscriptUtils] Creating entities from transcript data...');

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
      console.error('[TranscriptUtils] Failed to create company:', companyError);
      throw new Error(`Failed to create company: ${companyError.message}`);
    }

    console.log('[TranscriptUtils] Created company:', company.name, company.id);

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
        console.warn('[TranscriptUtils] Failed to create contact:', contact.name, contactError.message);
        continue;
      }

      contactIds.push(newContact.id);
      console.log('[TranscriptUtils] Created contact:', contact.name);
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
      console.warn('[TranscriptUtils] Failed to create deal:', dealError.message);
    } else {
      dealId = deal.id;
      dealName = deal.name;
      console.log('[TranscriptUtils] Created deal:', deal.name, deal.id);

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
    console.error('[TranscriptUtils] Error:', error);
    return null;
  }
}

// ============================================
// ENTITY REVIEW TASK
// ============================================

/**
 * Find similar companies by name (simple fuzzy matching)
 *
 * NOTE: This is an INTERNAL helper used ONLY for review task descriptions.
 * For actual entity matching, use `intelligentEntityMatch` from
 * '@/lib/intelligence/entityMatcher' which uses AI-powered disambiguation.
 *
 * This simple approach is intentionally kept for review task hints where
 * we want to show potential duplicates to the user for manual review.
 */
async function findSimilarCompanies(
  companyName: string,
  limit: number = 5
): Promise<Array<{ id: string; name: string; status: string; similarity: string }>> {
  const supabase = createAdminClient();

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, status')
    .limit(500);

  if (!companies) return [];

  const searchTerms = companyName.toLowerCase().split(/\s+/);

  const matches = companies
    .map((c) => {
      const nameLower = c.name.toLowerCase();
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
 */
export async function createEntityReviewTask(
  transcriptionId: string,
  transcriptionTitle: string,
  extractedData: ExtractedEntityData,
  matchResult: TranscriptMatchResult | null,
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

  descriptionParts.push('');
  descriptionParts.push(`**AI Confidence:** ${(extractedData.confidence * 100).toFixed(0)}%`);

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
  descriptionParts.push(`**Transcription ID:** ${transcriptionId}`);

  if (matchResult?.reasoning) {
    descriptionParts.push('');
    descriptionParts.push('**AI Reasoning:** ' + matchResult.reasoning);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);

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
    console.error('[TranscriptUtils] Failed to create review task:', error);
    return null;
  }

  return data?.id || null;
}
