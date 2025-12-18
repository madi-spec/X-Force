/**
 * AI Analysis Service
 *
 * Analyzes email conversations and generates draft responses
 */

import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { getPrompt } from '@/lib/ai/promptManager';

// ============================================================================
// Types
// ============================================================================

export interface EmailSignals {
  cc_escalation: boolean;
  legal_procurement: boolean;
  competitor_mentions: string[];
  budget_discussed: boolean;
  timeline_mentioned: string | null;
  buying_signals: string[];
  objections: string[];
  scheduling_proposed: string[];
  out_of_office: { until: string; delegate?: string } | null;
}

export interface ThreadAnalysis {
  priority: 'high' | 'medium' | 'low';
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  sentiment_trend: 'improving' | 'stable' | 'declining';
  summary: string;
  suggested_action: string;
  signals: EmailSignals;
  evidence_quotes: string[];
}

export interface DraftResponse {
  subject: string;
  body_html: string;
  body_text: string;
  confidence: number;
  needs_human_review: string[];
  placeholders: string[];
}

// ============================================================================
// Analysis
// ============================================================================

/**
 * Analyze a conversation thread
 */
export async function analyzeConversation(conversationId: string): Promise<ThreadAnalysis | null> {
  const supabase = createAdminClient();

  // Get conversation with context
  const { data: conversation } = await supabase
    .from('email_conversations')
    .select(
      `
      *,
      contact:contacts(id, name, title, persona),
      company:companies(id, name),
      deal:deals(id, name, stage, estimated_value)
    `
    )
    .eq('id', conversationId)
    .single();

  if (!conversation) return null;

  // Get messages
  const { data: messages } = await supabase
    .from('email_messages')
    .select('*')
    .eq('conversation_ref', conversationId)
    .order('received_at', { ascending: true });

  if (!messages || messages.length === 0) return null;

  // Get prompt configuration from database
  const promptConfig = await getPrompt('email_analysis');
  const model = promptConfig?.model || 'claude-sonnet-4-20250514';
  const maxTokens = promptConfig?.max_tokens || 1000;

  // Build thread messages string
  const threadMessages = messages
    .map(
      (m) => `
---
From: ${m.from_email}
CC: ${m.cc_emails?.join(', ') || 'none'}
Date: ${m.received_at || m.sent_at}
Body: ${m.body_preview}
`
    )
    .join('\n');

  // Build context strings
  const dealContext = conversation.deal
    ? `Deal: ${conversation.deal.name} - Stage: ${conversation.deal.stage} - Value: $${conversation.deal.estimated_value}`
    : 'No linked deal';
  const contactContext = conversation.contact
    ? `Contact: ${conversation.contact.name} (${conversation.contact.title || 'Unknown title'})`
    : 'Unknown contact';

  // Use prompt template from DB or fallback
  let prompt: string;
  if (promptConfig?.prompt_template) {
    prompt = promptConfig.prompt_template
      .replace(/\{\{threadMessages\}\}/g, threadMessages)
      .replace(/\{\{dealContext\}\}/g, dealContext)
      .replace(/\{\{contactContext\}\}/g, contactContext);
  } else {
    // Fallback to hardcoded prompt
    prompt = `Analyze this email thread and extract sales intelligence.

## Thread (oldest to newest)
${threadMessages}

## Context
${dealContext}
${contactContext}

---

Return JSON only, no other text:
{
  "priority": "high|medium|low",
  "category": "pricing|scheduling|objection|ready_to_buy|follow_up|info_request|general",
  "sentiment": "positive|neutral|negative|urgent",
  "sentiment_trend": "improving|stable|declining",
  "summary": "One sentence thread summary",
  "suggested_action": "What the rep should do next",
  "signals": {
    "cc_escalation": boolean,
    "legal_procurement": boolean,
    "competitor_mentions": ["names"],
    "budget_discussed": boolean,
    "timeline_mentioned": "Q1 2025" or null,
    "buying_signals": ["specific phrases"],
    "objections": ["specific objections"],
    "scheduling_proposed": ["proposed times"],
    "out_of_office": { "until": "ISO date", "delegate": "name" } or null
  },
  "evidence_quotes": ["1-3 quotes supporting analysis"]
}`;
  }

  try {
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const analysis: ThreadAnalysis = JSON.parse(jsonMatch[0]);

    // Update conversation with analysis
    await supabase
      .from('email_conversations')
      .update({
        ai_priority: analysis.priority,
        ai_category: analysis.category,
        ai_sentiment: analysis.sentiment,
        ai_sentiment_trend: analysis.sentiment_trend,
        ai_thread_summary: analysis.summary,
        ai_suggested_action: analysis.suggested_action,
        ai_evidence_quotes: analysis.evidence_quotes,
        signals: analysis.signals,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // Handle special signals
    await handleSignals(conversation, analysis.signals);

    return analysis;
  } catch (err) {
    console.error('[AI Analysis] Error analyzing conversation:', err);
    return null;
  }
}

/**
 * Handle special signals from analysis
 */
async function handleSignals(
  conversation: {
    id: string;
    user_id: string;
    subject?: string;
    deal_id?: string;
  },
  signals: EmailSignals
): Promise<void> {
  const supabase = createAdminClient();

  // Out of office → adjust SLA
  if (signals.out_of_office) {
    const returnDate = new Date(signals.out_of_office.until);
    if (returnDate > new Date()) {
      const newDueDate = new Date(returnDate);
      newDueDate.setDate(newDueDate.getDate() + 1);

      await supabase
        .from('email_conversations')
        .update({
          response_due_at: newDueDate.toISOString(),
          sla_status: 'ok',
        })
        .eq('id', conversation.id);
    }
  }

  // CC escalation or competitor mention → create notification (would integrate with notification system)
  // For now, just log for future enhancement
  if (signals.cc_escalation) {
    console.log(`[AI Analysis] CC escalation detected in conversation ${conversation.id}`);
  }

  if (signals.competitor_mentions.length > 0) {
    console.log(
      `[AI Analysis] Competitors mentioned: ${signals.competitor_mentions.join(', ')} in conversation ${conversation.id}`
    );
  }
}

// ============================================================================
// Draft Generation
// ============================================================================

export interface DraftGenerationResult {
  draft?: DraftResponse;
  error?: string;
}

/**
 * Generate a draft response for a conversation
 */
export async function generateDraftResponse(
  conversationId: string,
  trigger: string
): Promise<DraftGenerationResult> {
  const supabase = createAdminClient();

  // Check if draft already exists
  const { data: existingDraft } = await supabase
    .from('email_drafts')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('status', 'pending_review')
    .single();

  if (existingDraft) {
    return { error: 'A draft already exists for this conversation. Check the draft section above.' };
  }

  // Get conversation with context
  const { data: conversation } = await supabase
    .from('email_conversations')
    .select(
      `
      *,
      contact:contacts(id, name, email, title),
      company:companies(id, name),
      deal:deals(id, name, stage, estimated_value)
    `
    )
    .eq('id', conversationId)
    .single();

  if (!conversation) {
    return { error: 'Conversation not found' };
  }

  // Get latest inbound message
  const { data: latestMessage } = await supabase
    .from('email_messages')
    .select('*')
    .eq('conversation_ref', conversationId)
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(1)
    .single();

  if (!latestMessage) {
    return { error: 'No inbound message to reply to. AI drafts require an incoming message from the other party.' };
  }

  // Get prompt configuration from database
  const promptConfig = await getPrompt('email_draft');
  const model = promptConfig?.model || 'claude-sonnet-4-20250514';
  const maxTokens = promptConfig?.max_tokens || 1000;

  // Build context strings
  const dealContext = conversation.deal
    ? `Deal: ${conversation.deal.name} - Stage: ${conversation.deal.stage} - Value: $${conversation.deal.estimated_value}`
    : 'No active deal';
  const contactContext = conversation.contact
    ? `Contact: ${conversation.contact.name} (${conversation.contact.title || ''})`
    : '';

  // Use prompt template from DB or fallback
  let prompt: string;
  if (promptConfig?.prompt_template) {
    prompt = promptConfig.prompt_template
      .replace(/\{\{fromEmail\}\}/g, latestMessage.from_email)
      .replace(/\{\{subject\}\}/g, latestMessage.subject)
      .replace(/\{\{bodyPreview\}\}/g, latestMessage.body_preview)
      .replace(/\{\{threadSummary\}\}/g, conversation.ai_thread_summary || 'No summary available')
      .replace(/\{\{dealContext\}\}/g, dealContext)
      .replace(/\{\{contactContext\}\}/g, contactContext);
  } else {
    // Fallback to hardcoded prompt
    prompt = `Generate a professional reply email.

## Email to Reply To
From: ${latestMessage.from_email}
Subject: ${latestMessage.subject}
Body: ${latestMessage.body_preview}

## Thread Summary
${conversation.ai_thread_summary || 'No summary available'}

## Context
${dealContext}
${contactContext}

## Requirements
1. Be specific with pricing/next steps if available
2. Keep under 150 words
3. Be professional but friendly
4. Flag anything needing human verification

Return JSON only:
{
  "subject": "Re: ...",
  "body_html": "<p>HTML email body</p>",
  "body_text": "Plain text email body",
  "confidence": 0-100,
  "needs_human_review": ["things to verify"],
  "placeholders": ["[DATE_TO_CONFIRM]", etc]
}`;
  }

  try {
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { error: 'AI returned unexpected response format' };
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { error: 'AI response did not contain valid JSON' };
    }

    const draft: DraftResponse = JSON.parse(jsonMatch[0]);

    // Save draft
    const { error: insertError } = await supabase.from('email_drafts').insert({
      conversation_id: conversationId,
      user_id: conversation.user_id,
      subject: draft.subject,
      body_html: draft.body_html,
      body_text: draft.body_text,
      confidence: draft.confidence,
      generation_trigger: trigger,
      needs_human_review: draft.needs_human_review,
      placeholders: draft.placeholders,
      status: 'pending_review',
    });

    if (insertError) {
      console.error('[AI Analysis] Error saving draft:', insertError);
      return { error: `Failed to save draft: ${insertError.message}` };
    }

    // Update conversation
    await supabase
      .from('email_conversations')
      .update({
        has_pending_draft: true,
        draft_confidence: draft.confidence,
      })
      .eq('id', conversationId);

    return { draft };
  } catch (err) {
    console.error('[AI Analysis] Error generating draft:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: `AI generation failed: ${message}` };
  }
}

/**
 * Get pending drafts for a user
 */
export async function getPendingDrafts(userId: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_drafts')
    .select(
      `
      *,
      conversation:email_conversations(id, subject, contact_id, deal_id)
    `
    )
    .eq('user_id', userId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  return data || [];
}

/**
 * Update draft status
 */
export async function updateDraftStatus(
  draftId: string,
  status: 'edited' | 'sent' | 'discarded',
  sentMessageId?: string
): Promise<void> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'sent') {
    updates.sent_at = new Date().toISOString();
    if (sentMessageId) updates.sent_message_id = sentMessageId;
  }

  const { data: draft } = await supabase
    .from('email_drafts')
    .update(updates)
    .eq('id', draftId)
    .select('conversation_id')
    .single();

  if (draft) {
    // Update conversation draft status
    const { data: remainingDrafts } = await supabase
      .from('email_drafts')
      .select('id')
      .eq('conversation_id', draft.conversation_id)
      .eq('status', 'pending_review');

    if (!remainingDrafts || remainingDrafts.length === 0) {
      await supabase
        .from('email_conversations')
        .update({
          has_pending_draft: false,
          draft_confidence: null,
        })
        .eq('id', draft.conversation_id);
    }
  }
}

/**
 * Queue conversation for analysis (for background processing)
 */
export async function queueConversationAnalysis(conversationId: string): Promise<void> {
  // In a production system, this would add to a job queue
  // For now, we'll analyze immediately but async
  setTimeout(() => {
    analyzeConversation(conversationId).catch((err) =>
      console.error('[AI Analysis] Background analysis error:', err)
    );
  }, 100);
}
