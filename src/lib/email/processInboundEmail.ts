/**
 * Process Inbound Email
 *
 * Runs AI analysis on inbound emails and creates command center items.
 * Replaces keyword-based detection with deep AI understanding.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeEmail, saveEmailAnalysis, type AnalyzeEmailResult } from './analyzeEmail';
import type { PriorityTier } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

export interface ProcessResult {
  emailId: string;
  success: boolean;
  alreadyReplied: boolean;
  commandCenterItemId?: string;
  analysis?: AnalyzeEmailResult['analysis'];
  error?: string;
}

export interface BatchProcessResult {
  processed: number;
  itemsCreated: number;
  skippedAlreadyReplied: number;
  skippedAlreadyAnalyzed: number;
  errors: string[];
}

// ============================================
// INTERNAL DOMAINS TO SKIP
// ============================================

const INTERNAL_DOMAINS = new Set([
  'xrailabsteam.com',
  'xrailabs.com',
  'affiliatedtech.com',
  'x-rai.com',
]);

function isInternalEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  return domain ? INTERNAL_DOMAINS.has(domain) : false;
}

// ============================================
// CHECK IF ALREADY REPLIED
// ============================================

async function hasReplied(
  supabase: ReturnType<typeof createAdminClient>,
  conversationRef: string,
  receivedAt: string
): Promise<boolean> {
  // Check if there's a sent message after this one in the same thread
  const { data: sentMessages } = await supabase
    .from('email_messages')
    .select('id')
    .eq('conversation_ref', conversationRef)
    .eq('is_sent_by_user', true)
    .gt('received_at', receivedAt)
    .limit(1);

  return (sentMessages?.length || 0) > 0;
}

// ============================================
// CHECK IF COMMAND CENTER ITEM EXISTS
// ============================================

async function itemExists(
  supabase: ReturnType<typeof createAdminClient>,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('command_center_items')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();

  return !!data;
}

// ============================================
// GET CONVERSATION DETAILS
// ============================================

async function getConversation(
  supabase: ReturnType<typeof createAdminClient>,
  conversationRef: string
): Promise<{ deal_id: string | null; company_id: string | null; contact_id: string | null } | null> {
  const { data } = await supabase
    .from('email_conversations')
    .select('deal_id, company_id, contact_id')
    .eq('id', conversationRef)
    .single();

  return data;
}

// ============================================
// CALCULATE SLA DUE TIME
// ============================================

function calculateSlaDueAt(receivedAt: string, slaMinutes: number): string {
  const received = new Date(receivedAt);
  received.setMinutes(received.getMinutes() + slaMinutes);
  return received.toISOString();
}

// ============================================
// MAP TIER TO ACTION TYPE
// ============================================

function getActionType(tier: number, requestType: string): string {
  if (tier === 1) {
    if (requestType === 'demo_request') return 'call';
    if (requestType === 'meeting_request') return 'email_respond';
    return 'email_respond';
  }
  return 'email_respond';
}

// ============================================
// MAIN FUNCTION: Process Single Email
// ============================================

export async function processInboundEmail(emailId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();

  try {
    // 1. Get the email
    const { data: email, error: emailError } = await supabase
      .from('email_messages')
      .select('id, user_id, conversation_ref, from_email, from_name, subject, received_at, is_sent_by_user, analysis_complete')
      .eq('id', emailId)
      .single();

    if (emailError || !email) {
      return { emailId, success: false, alreadyReplied: false, error: 'Email not found' };
    }

    // Skip outbound emails
    if (email.is_sent_by_user) {
      return { emailId, success: false, alreadyReplied: false, error: 'Cannot process outbound emails' };
    }

    // Skip internal emails
    if (isInternalEmail(email.from_email)) {
      // Mark as processed but don't create item
      await supabase
        .from('email_messages')
        .update({ analysis_complete: true, processed_for_cc: true })
        .eq('id', emailId);
      return { emailId, success: true, alreadyReplied: false, error: 'Internal email - skipped' };
    }

    // 2. Check if already replied
    const alreadyReplied = await hasReplied(supabase, email.conversation_ref, email.received_at);
    if (alreadyReplied) {
      // Mark as processed
      await supabase
        .from('email_messages')
        .update({ analysis_complete: true, processed_for_cc: true })
        .eq('id', emailId);
      return { emailId, success: true, alreadyReplied: true };
    }

    // 3. Check if command center item already exists for this conversation
    const exists = await itemExists(supabase, email.conversation_ref, email.user_id);
    if (exists) {
      // Still run analysis if not done, but don't create duplicate item
      if (!email.analysis_complete) {
        const result = await analyzeEmail(emailId);
        await saveEmailAnalysis(result);
      }
      return { emailId, success: true, alreadyReplied: false, error: 'Item already exists' };
    }

    // 4. Run AI analysis
    const analysisResult = await analyzeEmail(emailId);

    // 5. Save analysis to email record
    await saveEmailAnalysis(analysisResult);

    // 6. Get conversation details for linking
    const conversation = await getConversation(supabase, email.conversation_ref);

    // Use context from analysis if conversation doesn't have links
    const dealId = conversation?.deal_id || analysisResult.context.deal?.id || null;
    const companyId = conversation?.company_id || analysisResult.context.company?.id || null;
    const contactId = conversation?.contact_id || analysisResult.context.contact?.id || null;

    // 7. Create command center item
    const analysis = analysisResult.analysis;
    const cc = analysis.command_center_classification;
    const fromName = email.from_name || email.from_email.split('@')[0];

    const { data: item, error: insertError } = await supabase
      .from('command_center_items')
      .insert({
        user_id: email.user_id,
        conversation_id: email.conversation_ref,
        deal_id: dealId,
        company_id: companyId,
        contact_id: contactId,
        action_type: getActionType(cc.tier, analysis.email_analysis.request_type),
        title: `${analysis.email_analysis.request_type === 'demo_request' ? 'Demo request from' : 'Reply to'} ${fromName}`,
        description: analysis.email_analysis.summary,
        why_now: cc.why_now,
        tier: cc.tier as PriorityTier,
        tier_trigger: cc.tier_trigger,
        sla_minutes: cc.sla_minutes,
        sla_status: 'on_track',
        received_at: email.received_at,
        due_at: calculateSlaDueAt(email.received_at, cc.sla_minutes),
        target_name: fromName,
        company_name: analysisResult.context.company?.name || null,
        deal_value: analysisResult.context.deal?.estimated_value || null,
        deal_stage: analysisResult.context.deal?.stage || null,
        status: 'pending',
        source: 'email_ai_analysis',
        // Store the rich analysis data
        email_analysis: analysis.email_analysis,
        buying_signals: analysis.buying_signals,
        concerns: analysis.concerns_detected,
        suggested_actions: analysis.suggested_actions,
        email_draft: analysis.response_draft,
      })
      .select('id')
      .single();

    if (insertError) {
      return {
        emailId,
        success: false,
        alreadyReplied: false,
        analysis: analysis,
        error: `Failed to create command center item: ${insertError.message}`,
      };
    }

    // 8. Mark email as processed
    await supabase
      .from('email_messages')
      .update({ processed_for_cc: true, cc_processed_at: new Date().toISOString() })
      .eq('id', emailId);

    return {
      emailId,
      success: true,
      alreadyReplied: false,
      commandCenterItemId: item?.id,
      analysis: analysis,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { emailId, success: false, alreadyReplied: false, error: errorMsg };
  }
}

// ============================================
// BATCH PROCESS: Unanalyzed Emails
// ============================================

export async function processUnanalyzedEmails(
  userId?: string,
  limit: number = 10
): Promise<BatchProcessResult> {
  const supabase = createAdminClient();
  const result: BatchProcessResult = {
    processed: 0,
    itemsCreated: 0,
    skippedAlreadyReplied: 0,
    skippedAlreadyAnalyzed: 0,
    errors: [],
  };

  // Query for unprocessed inbound emails
  let query = supabase
    .from('email_messages')
    .select('id')
    .eq('is_sent_by_user', false)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('received_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: emails, error } = await query;

  if (error) {
    result.errors.push(`Query error: ${error.message}`);
    return result;
  }

  if (!emails || emails.length === 0) {
    return result;
  }

  // Process each email
  for (const email of emails) {
    result.processed++;

    const processResult = await processInboundEmail(email.id);

    if (processResult.success) {
      if (processResult.alreadyReplied) {
        result.skippedAlreadyReplied++;
      } else if (processResult.commandCenterItemId) {
        result.itemsCreated++;
      }
    } else if (processResult.error) {
      if (processResult.error.includes('already exists')) {
        result.skippedAlreadyAnalyzed++;
      } else if (!processResult.error.includes('Internal email')) {
        result.errors.push(`${email.id}: ${processResult.error}`);
      }
    }
  }

  return result;
}

// ============================================
// EXPORTS
// ============================================

export { analyzeEmail, saveEmailAnalysis } from './analyzeEmail';
