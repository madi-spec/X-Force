/**
 * Process Inbound Email
 *
 * Runs AI analysis on inbound emails using the context-first pipeline.
 * Creates command center items based on analysis results.
 *
 * MIGRATED: Now uses processIncomingCommunication from contextFirstPipeline
 * instead of deprecated updateRelationshipFromAnalysis and processOutboundEmail.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeEmail, saveEmailAnalysis, type AnalyzeEmailResult } from './analyzeEmail';
// Migrated to context-first pipeline
import {
  processIncomingCommunication,
  type CommunicationInput,
  type ProcessingResult,
} from '@/lib/intelligence/contextFirstPipeline';
import type { PriorityTier, TierTrigger } from '@/types/commandCenter';
import { COMMUNICATION_TYPE_TIERS } from '@/lib/commandCenter/tierDetection';

// ============================================
// TYPES
// ============================================

export interface ProcessResult {
  emailId: string;
  success: boolean;
  alreadyReplied: boolean;
  commandCenterItemId?: string;
  analysis?: AnalyzeEmailResult['analysis'];
  pipelineResult?: ProcessingResult;
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
// UNKNOWN SENDER HANDLING
// ============================================

interface UnknownSenderEmailData {
  id: string;
  user_id: string;
  from_email: string;
  from_name?: string;
  subject?: string;
  body_preview?: string;
  received_at: string;
  conversation_ref: string;
}

/**
 * Create a Tier 1 command center item for emails from unknown senders.
 * These need immediate triage to determine if they're prospects, existing customers,
 * or spam that can be dismissed.
 */
async function createUnknownSenderItem(
  supabase: ReturnType<typeof createAdminClient>,
  email: UnknownSenderEmailData
): Promise<string | null> {
  const tierConfig = COMMUNICATION_TYPE_TIERS['unknown_sender'];
  const fromName = email.from_name || email.from_email.split('@')[0];
  const domain = email.from_email.split('@')[1] || 'unknown';

  // Calculate SLA due time
  const received = new Date(email.received_at);
  received.setMinutes(received.getMinutes() + tierConfig.sla_minutes);
  const dueAt = received.toISOString();

  // Create triage workflow steps
  const workflowSteps = [
    {
      id: 'identify',
      title: 'Identify sender - prospect, customer, or spam?',
      owner: 'sales_rep' as const,
      urgency: 'high' as const,
      completed: false,
      completed_at: null,
    },
    {
      id: 'link',
      title: 'Link to existing company or create new',
      owner: 'sales_rep' as const,
      urgency: 'medium' as const,
      completed: false,
      completed_at: null,
    },
    {
      id: 'respond',
      title: 'Respond or dismiss',
      owner: 'sales_rep' as const,
      urgency: 'high' as const,
      completed: false,
      completed_at: null,
    },
  ];

  const { data: item, error } = await supabase
    .from('command_center_items')
    .insert({
      user_id: email.user_id,
      conversation_id: email.conversation_ref,
      action_type: 'email_respond',
      title: `Triage: Email from ${fromName}`,
      description: email.subject || `New email from ${email.from_email}`,
      why_now: `New inbound from unknown sender (${domain}) — needs triage.`,
      tier: tierConfig.tier as PriorityTier,
      tier_trigger: 'unknown_sender' as TierTrigger,
      sla_minutes: tierConfig.sla_minutes,
      sla_status: 'on_track',
      received_at: email.received_at,
      due_at: dueAt,
      target_name: fromName,
      status: 'pending',
      source: 'email_inbound',
      source_id: email.id,
      email_id: email.id,
      workflow_steps: workflowSteps,
      // Store sender info for triage
      context_brief: `From: ${email.from_email}\nDomain: ${domain}\nSubject: ${email.subject || '(no subject)'}\n\nPreview: ${(email.body_preview || '').substring(0, 200)}`,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ProcessInbound] Failed to create unknown sender item:', error);
    return null;
  }

  return item?.id || null;
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
// CALCULATE SLA DUE TIME
// ============================================

function calculateSlaDueAt(receivedAt: string, slaMinutes: number): string {
  const received = new Date(receivedAt);
  received.setMinutes(received.getMinutes() + slaMinutes);
  return received.toISOString();
}

// ============================================
// GET TIER INFO FROM AI ANALYSIS OR MAPPING
// ============================================

/**
 * Get tier info from AI's command_center_classification (preferred)
 * or fall back to COMMUNICATION_TYPE_TIERS mapping
 */
function getTierInfo(
  aiClassification?: { tier: number; tier_trigger: string; sla_minutes: number; why_now: string },
  communicationType?: string
): { tier: PriorityTier; trigger: TierTrigger; slaMinutes: number; whyNow?: string } {
  // Prefer AI's direct classification if available
  if (aiClassification && aiClassification.tier_trigger) {
    return {
      tier: aiClassification.tier as PriorityTier,
      trigger: aiClassification.tier_trigger as TierTrigger,
      slaMinutes: aiClassification.sla_minutes,
      whyNow: aiClassification.why_now,
    };
  }

  // Fall back to COMMUNICATION_TYPE_TIERS mapping
  if (communicationType) {
    const config = COMMUNICATION_TYPE_TIERS[communicationType];
    if (config) {
      return {
        tier: config.tier,
        trigger: communicationType as TierTrigger,
        slaMinutes: config.sla_minutes,
      };
    }
  }

  // Default to Tier 4 email response
  return {
    tier: 4,
    trigger: 'email_reply' as TierTrigger,
    slaMinutes: 480,
  };
}

// ============================================
// MAIN FUNCTION: Process Single Email
// ============================================

export async function processInboundEmail(emailId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();

  try {
    // 1. Get the full email
    const { data: email, error: emailError } = await supabase
      .from('email_messages')
      .select('*')
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

    // 4. Build CommunicationInput for the context-first pipeline
    const communication: CommunicationInput = {
      type: 'email_inbound',
      from_email: email.from_email,
      from_name: email.from_name || undefined,
      to_emails: email.to_emails || [],
      subject: email.subject || undefined,
      body: email.body_text || email.body_preview || undefined,
    };

    // 5. Run context-first pipeline
    console.log(`[ProcessInbound] Running context-first pipeline for email ${emailId}`);
    let pipelineResult: ProcessingResult;

    try {
      pipelineResult = await processIncomingCommunication(communication, email.user_id);
      console.log(`[ProcessInbound] Pipeline complete: company=${pipelineResult.company?.name}, contact=${pipelineResult.contact?.name}`);
    } catch (pipelineError) {
      const errorMessage = pipelineError instanceof Error ? pipelineError.message : 'Unknown error';
      console.error('[ProcessInbound] Pipeline error:', errorMessage);

      // Check if this is an unknown sender (no company/contact match)
      if (errorMessage.includes('Could not identify company or contact')) {
        console.log(`[ProcessInbound] Creating Tier 1 unknown sender item for ${email.from_email}`);

        // Create Tier 1 triage item for unknown sender
        const unknownSenderItemId = await createUnknownSenderItem(supabase, {
          id: email.id,
          user_id: email.user_id,
          from_email: email.from_email,
          from_name: email.from_name,
          subject: email.subject,
          body_preview: email.body_preview,
          received_at: email.received_at,
          conversation_ref: email.conversation_ref,
        });

        // Mark email as processed
        await supabase
          .from('email_messages')
          .update({ processed_for_cc: true, cc_processed_at: new Date().toISOString() })
          .eq('id', emailId);

        return {
          emailId,
          success: true,
          alreadyReplied: false,
          commandCenterItemId: unknownSenderItemId || undefined,
        };
      }

      // For other pipeline errors, fall back to legacy analysis
      const analysisResult = await analyzeEmail(emailId);
      await saveEmailAnalysis(analysisResult);
      return {
        emailId,
        success: false,
        alreadyReplied: false,
        analysis: analysisResult.analysis,
        error: `Pipeline failed: ${errorMessage}`,
      };
    }

    // 6. Also run legacy analysis for backward compatibility (stores to email_messages)
    // Wrap in try/catch so pipeline success isn't blocked by analysis failure
    let analysisResult: AnalyzeEmailResult | null = null;
    try {
      analysisResult = await analyzeEmail(emailId);
      await saveEmailAnalysis(analysisResult);
    } catch (analysisError) {
      console.warn(`[ProcessInbound] Legacy analysis failed for ${emailId}, continuing with pipeline result:`, analysisError instanceof Error ? analysisError.message : analysisError);
    }

    // 7. Get tier info from AI analysis (preferred) or communication type mapping
    const analysis = pipelineResult.analysisWithContext;
    const aiClassification = analysisResult?.analysis?.command_center_classification;
    const tierInfo = getTierInfo(aiClassification, analysis.communication_type);
    const fromName = email.from_name || email.from_email.split('@')[0];

    // 8. Create command center item if actions were suggested
    let commandCenterItemId: string | undefined;

    if (pipelineResult.actionsCreated.length > 0) {
      // Use the first action created by the pipeline
      commandCenterItemId = pipelineResult.actionsCreated[0].id;

      // Update pipeline-created items with email context (email_id, source_id, tier info)
      for (const createdAction of pipelineResult.actionsCreated) {
        await supabase
          .from('command_center_items')
          .update({
            email_id: emailId,
            source_id: emailId,
            tier: tierInfo.tier,
            tier_trigger: tierInfo.trigger,
            sla_minutes: tierInfo.slaMinutes,
            sla_status: 'on_track',
            received_at: email.received_at,
            due_at: calculateSlaDueAt(email.received_at, tierInfo.slaMinutes),
          })
          .eq('id', createdAction.id);
      }
      console.log(`[ProcessInbound] Updated ${pipelineResult.actionsCreated.length} pipeline items with email context`);
    } else if (analysis.suggested_actions.length > 0) {
      // Create a command center item from suggested actions
      const primaryAction = analysis.suggested_actions[0];

      // Use AI's why_now if available, otherwise fall back to action's why_now
      const whyNow = tierInfo.whyNow || aiClassification?.why_now || primaryAction.why_now;

      const { data: item, error: insertError } = await supabase
        .from('command_center_items')
        .insert({
          user_id: email.user_id,
          conversation_id: email.conversation_ref,
          deal_id: pipelineResult.deal?.id || null,
          company_id: pipelineResult.company?.id || null,
          contact_id: pipelineResult.contact?.id || null,
          action_type: primaryAction.action_type || 'email_respond',
          title: primaryAction.title || `Reply to ${fromName}`,
          description: analysis.relationship_summary_update || analysisResult?.analysis?.email_analysis?.summary || '',
          why_now: whyNow,
          tier: tierInfo.tier,
          tier_trigger: tierInfo.trigger,
          sla_minutes: tierInfo.slaMinutes,
          sla_status: 'on_track',
          received_at: email.received_at,
          due_at: calculateSlaDueAt(email.received_at, tierInfo.slaMinutes),
          target_name: fromName,
          company_name: pipelineResult.company?.name || null,
          deal_value: pipelineResult.deal?.estimated_value || null,
          deal_stage: pipelineResult.deal?.stage || null,
          status: 'pending',
          source: 'email_ai_analysis',
          source_id: emailId,
          email_id: emailId,
          // Store the rich analysis data
          email_analysis: analysisResult?.analysis?.email_analysis,
          buying_signals: analysis.buying_signals,
          concerns: analysis.concerns_raised,
          suggested_actions: analysis.suggested_actions,
          email_draft: analysisResult?.analysis?.response_draft,
        })
        .select('id')
        .single();

      if (!insertError && item) {
        commandCenterItemId = item.id;
      }
    }

    // 9. Mark email as processed
    await supabase
      .from('email_messages')
      .update({ processed_for_cc: true, cc_processed_at: new Date().toISOString() })
      .eq('id', emailId);

    return {
      emailId,
      success: true,
      alreadyReplied: false,
      commandCenterItemId,
      analysis: analysisResult?.analysis,
      pipelineResult,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ProcessInbound] Error processing email ${emailId}:`, error);
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
  // Include both unanalyzed emails AND emails that were analyzed but failed CC processing
  let query = supabase
    .from('email_messages')
    .select('id')
    .eq('is_sent_by_user', false)
    .or('processed_for_cc.is.null,processed_for_cc.eq.false')
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
// PROCESS OUTBOUND EMAILS (using context-first pipeline)
// ============================================

export interface OutboundBatchResult {
  processed: number;
  commitmentsMade: number;
  errors: string[];
}

export async function processUnanalyzedOutboundEmails(
  userId?: string,
  limit: number = 10
): Promise<OutboundBatchResult> {
  const supabase = createAdminClient();
  const result: OutboundBatchResult = {
    processed: 0,
    commitmentsMade: 0,
    errors: [],
  };

  // Query for unprocessed outbound emails
  let query = supabase
    .from('email_messages')
    .select('*')
    .eq('is_sent_by_user', true)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('sent_at', { ascending: false })
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

  // Process each outbound email using context-first pipeline
  for (const email of emails) {
    try {
      const communication: CommunicationInput = {
        type: 'email_outbound',
        from_email: email.from_email,
        from_name: email.from_name || undefined,
        to_emails: email.to_emails || [],
        subject: email.subject || undefined,
        body: email.body_text || email.body_preview || undefined,
      };

      const pipelineResult = await processIncomingCommunication(communication, email.user_id);

      result.processed++;
      result.commitmentsMade += pipelineResult.analysisWithContext.commitment_updates.new_ours.length;

      // Mark as processed
      await supabase
        .from('email_messages')
        .update({ analysis_complete: true })
        .eq('id', email.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`${email.id}: ${errorMsg}`);
    }
  }

  return result;
}

// ============================================
// UNIFIED PROCESSING
// ============================================

export interface UnifiedBatchResult {
  inbound: BatchProcessResult;
  outbound: OutboundBatchResult;
}

/**
 * Process all unanalyzed emails (both inbound and outbound)
 * This is the main entry point for email analysis.
 */
export async function processAllUnanalyzedEmails(
  userId?: string,
  inboundLimit: number = 10,
  outboundLimit: number = 5
): Promise<UnifiedBatchResult> {
  const [inbound, outbound] = await Promise.all([
    processUnanalyzedEmails(userId, inboundLimit),
    processUnanalyzedOutboundEmails(userId, outboundLimit),
  ]);

  return { inbound, outbound };
}

// ============================================
// EXPORTS
// ============================================

export { analyzeEmail, saveEmailAnalysis } from './analyzeEmail';
