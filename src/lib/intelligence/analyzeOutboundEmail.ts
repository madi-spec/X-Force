/**
 * Outbound Email Analysis
 *
 * Analyzes emails sent BY our salespeople to extract:
 * - Commitments we made
 * - Content we shared
 * - Questions we asked
 * - Follow-up expectations
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';
import {
  getOrCreateRelationshipIntelligence,
  addInteraction,
  addCommitment,
  type Commitment,
  type Interaction,
} from './relationshipStore';

// ============================================
// TYPES
// ============================================

export interface OutboundEmailAnalysis {
  summary: string;
  commitments_made: Array<{
    commitment: string;
    deadline_mentioned: string | null;
    inferred_due_date: string | null;
  }>;
  content_shared: Array<{
    type: 'proposal' | 'pricing' | 'case_study' | 'contract' | 'info' | 'other';
    description: string;
  }>;
  questions_asked: string[];
  tone: string;
  follow_up_expected: {
    expected: boolean;
    expected_by: string | null;
    what: string | null;
  };
}

export interface EmailMessage {
  id: string;
  user_id: string;
  conversation_ref: string | null;
  subject: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  to_names: string[] | null;
  body_text: string | null;
  body_html: string | null;
  body_preview: string | null;
  sent_at: string | null;
  received_at: string | null;
  is_sent_by_user: boolean;
  ai_analysis: OutboundEmailAnalysis | null;
  analysis_complete: boolean;
  commitments_extracted: OutboundEmailAnalysis['commitments_made'] | null;
  relationship_updated: boolean;
}

interface RecipientContext {
  contact: {
    id: string;
    name: string;
    email: string;
    title: string | null;
    company_id: string | null;
  } | null;
  company: {
    id: string;
    name: string;
    industry: string | null;
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string | null;
    estimated_value: number | null;
  } | null;
}

// ============================================
// CONTEXT GATHERING
// ============================================

/**
 * Get context about the email recipient
 */
async function getRecipientContext(toEmails: string[]): Promise<RecipientContext> {
  const supabase = createAdminClient();

  // Find contact by email
  let contact = null;
  let company = null;
  let deal = null;

  for (const email of toEmails) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, name, email, title, company_id')
      .ilike('email', email)
      .single();

    if (contactData) {
      contact = contactData;
      break;
    }
  }

  // Get company if contact found
  if (contact?.company_id) {
    const { data: companyData } = await supabase
      .from('companies')
      .select('id, name, industry')
      .eq('id', contact.company_id)
      .single();

    company = companyData;
  }

  // Get active deal for this contact
  if (contact) {
    const { data: dealContact } = await supabase
      .from('deal_contacts')
      .select('deal_id')
      .eq('contact_id', contact.id)
      .single();

    if (dealContact) {
      const { data: dealData } = await supabase
        .from('deals')
        .select('id, name, stage, estimated_value')
        .eq('id', dealContact.deal_id)
        .not('stage', 'in', '("closed_won","closed_lost")')
        .single();

      deal = dealData;
    }
  }

  return { contact, company, deal };
}

// ============================================
// HELPERS
// ============================================

/**
 * Strip HTML tags and get plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get email body text, extracting from HTML if needed
 */
function getEmailBodyText(email: EmailMessage): string {
  if (email.body_text) return email.body_text;
  if (email.body_html) return stripHtml(email.body_html);
  return email.body_preview || '(no content)';
}

// ============================================
// AI ANALYSIS
// ============================================

/**
 * Analyze an outbound email with Claude
 */
async function analyzeWithAI(
  email: EmailMessage,
  context: RecipientContext
): Promise<OutboundEmailAnalysis> {
  const emailBody = getEmailBodyText(email);

  const prompt = `Analyze this OUTBOUND email (sent by our salesperson) to extract commitments and follow-up expectations.

## CONTEXT
Recipient: ${context.contact?.name || 'Unknown'} (${email.to_emails[0] || 'unknown'})
${context.contact?.title ? `Title: ${context.contact.title}` : ''}
Company: ${context.company?.name || 'Unknown'}
${context.company?.industry ? `Industry: ${context.company.industry}` : ''}
${context.deal ? `Deal: ${context.deal.name} - ${context.deal.stage} - $${context.deal.estimated_value?.toLocaleString() || 'N/A'}` : 'No active deal'}

## THE EMAIL WE SENT
To: ${email.to_emails.join(', ')}
Subject: ${email.subject || '(no subject)'}
Date: ${email.sent_at || email.received_at || 'Unknown'}

${emailBody}

---

Return JSON with these fields:
{
  "summary": "One sentence summary of what this email does",
  "commitments_made": [
    {
      "commitment": "What we promised to do",
      "deadline_mentioned": "Friday" or null if none mentioned,
      "inferred_due_date": "2024-12-20" or null (infer from context if deadline mentioned)
    }
  ],
  "content_shared": [
    {
      "type": "proposal" | "pricing" | "case_study" | "contract" | "info" | "other",
      "description": "Brief description of what was shared"
    }
  ],
  "questions_asked": ["List of questions we asked them"],
  "tone": "Brief description of our tone/approach",
  "follow_up_expected": {
    "expected": true or false,
    "expected_by": "2024-12-23" or null,
    "what": "What we expect them to do next"
  }
}

IMPORTANT:
- Only include commitments that are actual promises to do something
- "Let me know if you have questions" is NOT a commitment
- "I'll send the proposal by Friday" IS a commitment
- Be specific about deadlines - infer dates from context (today is ${new Date().toISOString().split('T')[0]})
- If no commitments were made, return an empty array`;

  const schema = `{
  "summary": "string",
  "commitments_made": [{"commitment": "string", "deadline_mentioned": "string|null", "inferred_due_date": "string|null"}],
  "content_shared": [{"type": "proposal|pricing|case_study|contract|info|other", "description": "string"}],
  "questions_asked": ["string"],
  "tone": "string",
  "follow_up_expected": {"expected": "boolean", "expected_by": "string|null", "what": "string|null"}
}`;

  const result = await callAIJson<OutboundEmailAnalysis>({
    prompt,
    schema,
    maxTokens: 1500,
  });

  return result.data;
}

// ============================================
// STORAGE
// ============================================

/**
 * Store the analysis results in the database
 */
async function storeAnalysis(
  emailId: string,
  analysis: OutboundEmailAnalysis
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('email_messages')
    .update({
      ai_analysis: analysis,
      commitments_extracted: analysis.commitments_made,
      analysis_complete: true,
    })
    .eq('id', emailId);
}

/**
 * Update the relationship intelligence with this email's data
 */
async function updateRelationship(
  emailId: string,
  email: EmailMessage,
  analysis: OutboundEmailAnalysis,
  context: RecipientContext
): Promise<string | null> {
  if (!context.contact?.id && !context.company?.id) {
    console.log('[OutboundAnalysis] No contact or company to update relationship for');
    return null;
  }

  // Get or create relationship record
  const relationship = await getOrCreateRelationshipIntelligence(
    context.contact?.id || null,
    context.company?.id || null
  );

  // Add this email as an interaction
  const interaction: Interaction = {
    id: emailId,
    type: 'email_outbound',
    date: email.sent_at || email.received_at || new Date().toISOString(),
    summary: analysis.summary,
    key_points: [
      ...analysis.content_shared.map(c => `Shared ${c.type}: ${c.description}`),
      ...analysis.questions_asked.map(q => `Asked: ${q}`),
    ],
    commitments_made: analysis.commitments_made.map(c => c.commitment),
  };

  await addInteraction(relationship.id, interaction);

  // Add each commitment to the relationship
  for (const commit of analysis.commitments_made) {
    const commitment: Commitment = {
      commitment: commit.commitment,
      made_on: email.sent_at || email.received_at || new Date().toISOString(),
      due_by: commit.inferred_due_date || undefined,
      source_type: 'email_outbound',
      source_id: emailId,
      status: 'pending',
    };

    await addCommitment(relationship.id, commitment, 'ours');
  }

  // Mark email as having updated the relationship
  const supabase = createAdminClient();
  await supabase
    .from('email_messages')
    .update({ relationship_updated: true })
    .eq('id', emailId);

  return relationship.id;
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

/**
 * Process a single outbound email
 * - Analyzes with AI
 * - Stores analysis
 * - Updates relationship intelligence
 */
export async function processOutboundEmail(emailId: string): Promise<{
  success: boolean;
  analysis?: OutboundEmailAnalysis;
  relationshipId?: string;
  error?: string;
}> {
  const supabase = createAdminClient();

  console.log(`[OutboundAnalysis] Processing email ${emailId}`);

  // Get the email
  const { data: email, error: fetchError } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', emailId)
    .single();

  if (fetchError || !email) {
    return { success: false, error: `Email not found: ${fetchError?.message}` };
  }

  // Verify it's an outbound email
  if (!email.is_sent_by_user) {
    return { success: false, error: 'Not an outbound email' };
  }

  // Skip if already analyzed
  if (email.analysis_complete) {
    console.log(`[OutboundAnalysis] Email ${emailId} already analyzed`);
    return {
      success: true,
      analysis: email.ai_analysis as OutboundEmailAnalysis,
    };
  }

  try {
    // Get recipient context
    const context = await getRecipientContext(email.to_emails || []);
    console.log(`[OutboundAnalysis] Context:`, {
      contact: context.contact?.name,
      company: context.company?.name,
      deal: context.deal?.name,
    });

    // Analyze with AI
    const analysis = await analyzeWithAI(email as EmailMessage, context);
    console.log(`[OutboundAnalysis] Analysis complete:`, {
      summary: analysis.summary,
      commitments: analysis.commitments_made.length,
      contentShared: analysis.content_shared.length,
      questionsAsked: analysis.questions_asked.length,
    });

    // Store analysis
    await storeAnalysis(emailId, analysis);

    // Update relationship
    const relationshipId = await updateRelationship(
      emailId,
      email as EmailMessage,
      analysis,
      context
    );

    return {
      success: true,
      analysis,
      relationshipId: relationshipId || undefined,
    };
  } catch (err) {
    console.error(`[OutboundAnalysis] Error processing email ${emailId}:`, err);
    return { success: false, error: String(err) };
  }
}

/**
 * Process all unanalyzed outbound emails for a user
 */
export async function processUnanalyzedOutboundEmails(
  userId: string,
  limit: number = 50
): Promise<{
  processed: number;
  errors: number;
  commitmentsMade: number;
}> {
  const supabase = createAdminClient();

  // Find unanalyzed outbound emails
  const { data: emails, error } = await supabase
    .from('email_messages')
    .select('id')
    .eq('user_id', userId)
    .eq('is_sent_by_user', true)
    .eq('analysis_complete', false)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error || !emails) {
    console.error('[OutboundAnalysis] Failed to fetch emails:', error);
    return { processed: 0, errors: 1, commitmentsMade: 0 };
  }

  console.log(`[OutboundAnalysis] Found ${emails.length} unanalyzed outbound emails`);

  let processed = 0;
  let errors = 0;
  let commitmentsMade = 0;

  for (const email of emails) {
    const result = await processOutboundEmail(email.id);
    if (result.success) {
      processed++;
      commitmentsMade += result.analysis?.commitments_made.length || 0;
    } else {
      errors++;
    }
  }

  return { processed, errors, commitmentsMade };
}
