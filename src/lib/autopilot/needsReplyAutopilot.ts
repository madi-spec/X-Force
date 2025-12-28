/**
 * Needs Reply Autopilot
 *
 * Automatically processes communications awaiting our response:
 * 1. Finds communications where awaiting_our_response=true
 * 2. Evaluates safety rules for each communication
 * 3. Auto-sends replies if safe (simple logistics, no pricing/objections)
 * 4. Creates NEEDS_REPLY flags if human review needed
 *
 * Reuses:
 * - sendEmail from src/lib/microsoft/emailSync.ts
 * - AI prompts system for reply generation
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/microsoft/emailSync';
import { getPromptWithVariables } from '@/lib/ai/promptManager';
import { callAIJson } from '@/lib/ai/core/aiClient';
import {
  AutopilotWorkflowResult,
  NeedsReplyAutopilotItem,
} from './types';
import {
  generateIdempotencyKey,
  checkIdempotency,
  logSuccess,
  logFailure,
  logSkipped,
  createNeedsReplyFlag,
  createSystemErrorFlag,
  createEmptyResult,
  incrementResult,
  addError,
  firstOrNull,
  updateLastAITouch,
  setNextStepDueAt,
} from './helpers';
import { evaluateNeedsReplySafety, isValidEmail } from './safetyRules';

// ============================================
// NEEDS REPLY AUTOPILOT
// ============================================

interface NeedsReplyAutopilotOptions {
  dryRun?: boolean;
  userId?: string;
  limit?: number;
}

/**
 * Run the needs-reply autopilot workflow.
 */
export async function runNeedsReplyAutopilot(
  options: NeedsReplyAutopilotOptions = {}
): Promise<AutopilotWorkflowResult> {
  const result = createEmptyResult();
  const supabase = createAdminClient();

  try {
    // 1. Get communications awaiting our response
    const { data: communications, error: fetchError } = await supabase
      .from('communications')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .eq('awaiting_our_response', true)
      .is('responded_at', null)
      .order('response_due_by', { ascending: true, nullsFirst: false })
      .limit(options.limit || 50);

    if (fetchError) {
      addError(result, `Failed to fetch communications: ${fetchError.message}`);
      return result;
    }

    if (!communications || communications.length === 0) {
      return result;
    }

    // 2. Process each communication
    for (const comm of communications) {
      await processCommunication(
        comm as unknown as NeedsReplyAutopilotItem,
        result,
        options
      );
    }
  } catch (err) {
    addError(result, `Needs reply autopilot error: ${(err as Error).message}`);
  }

  return result;
}

/**
 * Process a single communication.
 */
async function processCommunication(
  comm: NeedsReplyAutopilotItem,
  result: AutopilotWorkflowResult,
  options: NeedsReplyAutopilotOptions
): Promise<void> {
  const supabase = createAdminClient();
  incrementResult(result, 'processed');

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(
    'communications',
    comm.id,
    'reply'
  );

  // Check if already processed
  const canProceed = await checkIdempotency(idempotencyKey);
  if (!canProceed) {
    incrementResult(result, 'actionsSkipped');
    return;
  }

  // Fetch company_product for safety evaluation if company_id exists
  let companyProduct: { id: string; risk_level: string | null; open_objections: unknown[] } | null = null;
  if (comm.company_id) {
    const { data: cp } = await supabase
      .from('company_products')
      .select('id, risk_level, open_objections')
      .eq('company_id', comm.company_id)
      .maybeSingle();
    companyProduct = cp;
  }

  // Evaluate safety rules (pass company_product for risk evaluation)
  const commWithProduct = { ...comm, company_product: companyProduct };
  const safetyEval = evaluateNeedsReplySafety(commWithProduct as NeedsReplyAutopilotItem);

  if (!safetyEval.canProceed) {
    // Create attention flag for human review
    if (!options.dryRun) {

      const flagId = await createNeedsReplyFlag(
        comm.company_id,
        safetyEval.reason,
        comm.id,
        companyProduct?.id,
        safetyEval.riskLevel === 'high' ? 'high' : 'medium'
      );

      await logSuccess('communications', 'FLAG_CREATED', {
        communication_id: comm.id,
        company_id: comm.company_id,
        contact_id: comm.contact_id || undefined,
        attention_flag_id: flagId || undefined,
        idempotency_key: idempotencyKey,
        ai_reasoning: safetyEval.reason,
        outputs: { flag_type: 'NEEDS_REPLY' },
      });
    }

    incrementResult(result, 'flagsCreated');
    return;
  }

  // Generate and send auto-reply
  if (!options.dryRun) {
    const contact = firstOrNull(comm.contact);
    const company = firstOrNull(comm.company);

    if (!contact?.email || !isValidEmail(contact.email)) {
      await logSkipped('communications', 'EMAIL_SENT', 'Invalid contact email', {
        communication_id: comm.id,
        company_id: comm.company_id,
        idempotency_key: idempotencyKey,
      });
      incrementResult(result, 'actionsSkipped');
      return;
    }

    // Get user ID - for autopilot, we need a system user or the account owner
    const userId = options.userId || await getCompanyOwnerUserId(comm.company_id);
    if (!userId) {
      await logSkipped('communications', 'EMAIL_SENT', 'No user ID available', {
        communication_id: comm.id,
        company_id: comm.company_id,
        idempotency_key: idempotencyKey,
      });
      incrementResult(result, 'actionsSkipped');
      return;
    }

    try {
      // Generate reply using AI
      const reply = await generateAutoReply(
        comm,
        contact?.name || 'there',
        company?.name || 'your company'
      );

      if (!reply) {
        await logSkipped('communications', 'EMAIL_SENT', 'Failed to generate reply', {
          communication_id: comm.id,
          company_id: comm.company_id,
          idempotency_key: idempotencyKey,
        });
        incrementResult(result, 'actionsSkipped');
        return;
      }

      // Send the email
      const sendResult = await sendEmail(
        userId,
        [contact.email],
        reply.subject,
        reply.body
      );

      if (sendResult.success) {
        // Mark communication as responded
        await supabase
          .from('communications')
          .update({
            awaiting_our_response: false,
            responded_at: new Date().toISOString(),
          })
          .eq('id', comm.id);

        // Update company product timestamps if available
        if (companyProduct?.id) {
          await updateLastAITouch(companyProduct.id);
          await setNextStepDueAt(companyProduct.id, 3); // Follow up in 3 days
        }

        await logSuccess('communications', 'EMAIL_SENT', {
          communication_id: comm.id,
          company_id: comm.company_id,
          contact_id: comm.contact_id || undefined,
          company_product_id: companyProduct?.id,
          idempotency_key: idempotencyKey,
          ai_reasoning: 'Auto-replied - safe communication type (simple logistics)',
          inputs: {
            originalSubject: comm.subject,
            contentPreview: (comm.content_preview || '').slice(0, 200),
          },
          outputs: {
            subject: reply.subject,
            bodyPreview: reply.body.slice(0, 200),
            sentTo: contact.email,
          },
        });

        incrementResult(result, 'actionsSent');
      } else {
        await logFailure('communications', 'EMAIL_SENT', sendResult.error || 'Unknown error', {
          communication_id: comm.id,
          company_id: comm.company_id,
          idempotency_key: idempotencyKey,
        });

        // Create system error flag
        await createSystemErrorFlag(
          comm.company_id,
          `Auto-reply email send failed: ${sendResult.error}`,
          comm.id
        );
        incrementResult(result, 'flagsCreated');

        addError(result, `Comm ${comm.id}: ${sendResult.error}`);
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      await logFailure('communications', 'ERROR', errorMsg, {
        communication_id: comm.id,
        company_id: comm.company_id,
        idempotency_key: idempotencyKey,
      });
      addError(result, `Comm ${comm.id}: ${errorMsg}`);
    }
  } else {
    // Dry run - count as executed
    incrementResult(result, 'actionsSent');
  }

  incrementResult(result, 'actionsExecuted');
}

/**
 * Generate an auto-reply using AI prompts.
 */
async function generateAutoReply(
  comm: NeedsReplyAutopilotItem,
  contactName: string,
  companyName: string
): Promise<{ subject: string; body: string } | null> {
  try {
    // Try to use the AI prompts system for reply generation
    const promptData = await getPromptWithVariables('email_auto_reply', {
      contactName,
      companyName,
      originalSubject: comm.subject || 'Your message',
      contentPreview: (comm.content_preview || '').slice(0, 500),
    });

    if (promptData) {
      const { data: response } = await callAIJson<{ subject: string; body: string }>({
        prompt: promptData.prompt,
        schema: promptData.schema || undefined,
        model: promptData.model as 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514',
        maxTokens: promptData.maxTokens,
      });

      if (response?.subject && response?.body) {
        return response;
      }
    }

    // Fallback: Generate a simple confirmation reply
    const originalSubject = comm.subject || 'Your message';
    const replySubject = originalSubject.startsWith('Re:')
      ? originalSubject
      : `Re: ${originalSubject}`;

    return {
      subject: replySubject,
      body: `Hi ${contactName},

Thank you for your message. I wanted to confirm I received this and will follow up shortly.

Best regards`,
    };
  } catch (err) {
    console.error('[NeedsReplyAutopilot] Error generating reply:', err);
    return null;
  }
}

/**
 * Get the owner user ID for a company.
 */
async function getCompanyOwnerUserId(companyId: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Try to get from company_products first
  const { data: cp } = await supabase
    .from('company_products')
    .select('owner_user_id')
    .eq('company_id', companyId)
    .not('owner_user_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (cp?.owner_user_id) {
    return cp.owner_user_id;
  }

  // Fallback to getting any admin user
  const { data: admin } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  return admin?.id || null;
}

/**
 * Get summary of pending needs-reply items (for debugging/monitoring).
 */
export async function getNeedsReplyAutopilotStatus(): Promise<{
  pendingReplies: number;
  overdueReplies: number;
  lastRunAt: string | null;
}> {
  const supabase = createAdminClient();

  // Count pending replies
  const { count: pendingCount } = await supabase
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('awaiting_our_response', true)
    .is('responded_at', null);

  // Count overdue replies
  const { count: overdueCount } = await supabase
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .lte('response_due_by', new Date().toISOString());

  // Get last run time
  const { data: lastAction } = await supabase
    .from('ai_action_log')
    .select('created_at')
    .eq('source', 'communications')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    pendingReplies: pendingCount || 0,
    overdueReplies: overdueCount || 0,
    lastRunAt: lastAction?.created_at || null,
  };
}
