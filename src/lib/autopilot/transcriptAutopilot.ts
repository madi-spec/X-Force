/**
 * Transcript Follow-up Autopilot
 *
 * Automatically processes meeting transcripts with analysis:
 * 1. Finds transcripts with analysis but no follow-up sent
 * 2. Evaluates safety rules for each transcript
 * 3. Auto-sends follow-up emails if safe
 * 4. Creates NO_NEXT_STEP_AFTER_MEETING flags if human review needed
 *
 * Reuses:
 * - sendEmail from src/lib/microsoft/emailSync.ts
 * - AI prompts system for follow-up generation
 * - processTranscriptAnalysis patterns
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/microsoft/emailSync';
import { getPromptWithVariables } from '@/lib/ai/promptManager';
import { callAIJson } from '@/lib/ai/core/aiClient';
import {
  AutopilotWorkflowResult,
  TranscriptAutopilotItem,
} from './types';
import {
  generateIdempotencyKey,
  checkIdempotency,
  logSuccess,
  logFailure,
  logSkipped,
  createNoNextStepFlag,
  createSystemErrorFlag,
  createEmptyResult,
  incrementResult,
  addError,
  firstOrNull,
  updateLastAITouch,
  setNextStepDueAt,
} from './helpers';
import { evaluateTranscriptFollowupSafety, isValidEmail } from './safetyRules';

// ============================================
// TRANSCRIPT AUTOPILOT
// ============================================

interface TranscriptAutopilotOptions {
  dryRun?: boolean;
  userId?: string;
  limit?: number;
}

/**
 * Run the transcript follow-up autopilot workflow.
 */
export async function runTranscriptAutopilot(
  options: TranscriptAutopilotOptions = {}
): Promise<AutopilotWorkflowResult> {
  const result = createEmptyResult();
  const supabase = createAdminClient();

  try {
    // 1. Get transcripts with analysis that haven't had follow-up sent
    const { data: transcripts, error: fetchError } = await supabase
      .from('meeting_transcriptions')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .not('analysis', 'is', null)
      .eq('follow_up_sent', false)
      .order('meeting_date', { ascending: false })
      .limit(options.limit || 20);

    if (fetchError) {
      addError(result, `Failed to fetch transcripts: ${fetchError.message}`);
      return result;
    }

    if (!transcripts || transcripts.length === 0) {
      return result;
    }

    // 2. Process each transcript
    for (const transcript of transcripts) {
      await processTranscript(
        transcript as unknown as TranscriptAutopilotItem,
        result,
        options
      );
    }
  } catch (err) {
    addError(result, `Transcript autopilot error: ${(err as Error).message}`);
  }

  return result;
}

/**
 * Process a single transcript.
 */
async function processTranscript(
  transcript: TranscriptAutopilotItem,
  result: AutopilotWorkflowResult,
  options: TranscriptAutopilotOptions
): Promise<void> {
  const supabase = createAdminClient();
  incrementResult(result, 'processed');

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(
    'transcript',
    transcript.id,
    'followup'
  );

  // Check if already processed
  const canProceed = await checkIdempotency(idempotencyKey);
  if (!canProceed) {
    incrementResult(result, 'actionsSkipped');
    return;
  }

  // Evaluate safety rules
  const safetyEval = evaluateTranscriptFollowupSafety(transcript);

  if (!safetyEval.canProceed) {
    // Create attention flag for human review
    if (!options.dryRun && transcript.company_id) {
      // Get company product
      const { data: companyProduct } = await supabase
        .from('company_products')
        .select('id')
        .eq('company_id', transcript.company_id)
        .maybeSingle();

      const flagId = await createNoNextStepFlag(
        transcript.company_id,
        safetyEval.reason,
        transcript.id,
        companyProduct?.id
      );

      await logSuccess('transcript', 'FLAG_CREATED', {
        transcription_id: transcript.id,
        company_id: transcript.company_id,
        contact_id: transcript.contact_id || undefined,
        attention_flag_id: flagId || undefined,
        idempotency_key: idempotencyKey,
        ai_reasoning: safetyEval.reason,
        outputs: { flag_type: 'NO_NEXT_STEP_AFTER_MEETING' },
      });
    }

    incrementResult(result, 'flagsCreated');
    return;
  }

  // Generate and send follow-up email
  if (!options.dryRun) {
    const contact = firstOrNull(transcript.contact);
    const company = firstOrNull(transcript.company);

    if (!contact?.email || !isValidEmail(contact.email)) {
      await logSkipped('transcript', 'EMAIL_SENT', 'Invalid contact email', {
        transcription_id: transcript.id,
        company_id: transcript.company_id || undefined,
        idempotency_key: idempotencyKey,
      });
      incrementResult(result, 'actionsSkipped');
      return;
    }

    // Get user ID - prefer transcript owner, then options, then fallback
    const userId = transcript.user_id || options.userId;
    if (!userId) {
      await logSkipped('transcript', 'EMAIL_SENT', 'No user ID available', {
        transcription_id: transcript.id,
        company_id: transcript.company_id || undefined,
        idempotency_key: idempotencyKey,
      });
      incrementResult(result, 'actionsSkipped');
      return;
    }

    try {
      // Generate follow-up using AI
      const followup = await generateMeetingFollowup(
        transcript,
        contact?.name || 'there',
        company?.name || 'your company'
      );

      if (!followup) {
        await logSkipped('transcript', 'EMAIL_SENT', 'Failed to generate follow-up', {
          transcription_id: transcript.id,
          company_id: transcript.company_id || undefined,
          idempotency_key: idempotencyKey,
        });
        incrementResult(result, 'actionsSkipped');
        return;
      }

      // Send the email
      const sendResult = await sendEmail(
        userId,
        [contact.email],
        followup.subject,
        followup.body
      );

      if (sendResult.success) {
        // Mark transcript as follow-up sent
        await supabase
          .from('meeting_transcriptions')
          .update({
            follow_up_sent: true,
            follow_up_sent_at: new Date().toISOString(),
          })
          .eq('id', transcript.id);

        // Update company product timestamps if available
        if (transcript.company_id) {
          const { data: companyProduct } = await supabase
            .from('company_products')
            .select('id')
            .eq('company_id', transcript.company_id)
            .maybeSingle();

          if (companyProduct?.id) {
            await updateLastAITouch(companyProduct.id);
            await setNextStepDueAt(companyProduct.id, 5); // Follow up in 5 days
          }
        }

        await logSuccess('transcript', 'EMAIL_SENT', {
          transcription_id: transcript.id,
          company_id: transcript.company_id || undefined,
          contact_id: transcript.contact_id || undefined,
          idempotency_key: idempotencyKey,
          ai_reasoning: 'Auto-sent meeting follow-up - all safety checks passed',
          inputs: {
            meetingTitle: transcript.title,
            meetingDate: transcript.meeting_date,
          },
          outputs: {
            subject: followup.subject,
            bodyPreview: followup.body.slice(0, 200),
            sentTo: contact.email,
          },
        });

        incrementResult(result, 'actionsSent');
      } else {
        await logFailure('transcript', 'EMAIL_SENT', sendResult.error || 'Unknown error', {
          transcription_id: transcript.id,
          company_id: transcript.company_id || undefined,
          idempotency_key: idempotencyKey,
        });

        // Create system error flag
        if (transcript.company_id) {
          await createSystemErrorFlag(
            transcript.company_id,
            `Meeting follow-up email send failed: ${sendResult.error}`,
            transcript.id
          );
          incrementResult(result, 'flagsCreated');
        }

        addError(result, `Transcript ${transcript.id}: ${sendResult.error}`);
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      await logFailure('transcript', 'ERROR', errorMsg, {
        transcription_id: transcript.id,
        company_id: transcript.company_id || undefined,
        idempotency_key: idempotencyKey,
      });
      addError(result, `Transcript ${transcript.id}: ${errorMsg}`);
    }
  } else {
    // Dry run - count as executed
    incrementResult(result, 'actionsSent');
  }

  incrementResult(result, 'actionsExecuted');
}

/**
 * Generate a meeting follow-up email using AI.
 */
async function generateMeetingFollowup(
  transcript: TranscriptAutopilotItem,
  contactName: string,
  companyName: string
): Promise<{ subject: string; body: string } | null> {
  try {
    const analysis = transcript.analysis as Record<string, unknown>;

    // Extract key info from analysis
    const actionItems = (analysis?.actionItems as unknown[]) || [];
    const ourCommitments = (analysis?.ourCommitments as unknown[]) || [];
    const nextSteps = (analysis?.nextSteps as unknown[]) || [];
    const summary = (analysis?.summary as string) || '';

    // Format action items for the prompt
    const actionItemsText = actionItems
      .map((item: unknown) => {
        const a = item as { description?: string; owner?: string };
        return `- ${a.description || 'Action item'} (Owner: ${a.owner || 'TBD'})`;
      })
      .join('\n');

    const commitmentsText = ourCommitments
      .map((item: unknown) => {
        const c = item as { commitment?: string };
        return `- ${c.commitment || 'Commitment'}`;
      })
      .join('\n');

    // Try to use the AI prompts system
    const promptData = await getPromptWithVariables('email_followup_stalled', {
      contactName,
      companyName,
      meetingTitle: transcript.title || 'Our meeting',
      meetingDate: new Date(transcript.meeting_date).toLocaleDateString(),
      summary: summary.slice(0, 500),
      actionItems: actionItemsText || 'None specified',
      ourCommitments: commitmentsText || 'None specified',
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

    // Fallback: Generate a simple follow-up
    const meetingDate = new Date(transcript.meeting_date).toLocaleDateString();
    const meetingTitle = transcript.title || 'our meeting';

    return {
      subject: `Follow-up: ${meetingTitle}`,
      body: `Hi ${contactName},

Thank you for taking the time to meet on ${meetingDate}. I wanted to follow up and ensure we're aligned on next steps.

${summary ? `Summary:\n${summary.slice(0, 300)}\n` : ''}
${actionItemsText ? `Action Items:\n${actionItemsText}\n` : ''}
${commitmentsText ? `Our Commitments:\n${commitmentsText}\n` : ''}
Please let me know if you have any questions or if there's anything else you'd like to discuss.

Best regards`,
    };
  } catch (err) {
    console.error('[TranscriptAutopilot] Error generating follow-up:', err);
    return null;
  }
}

/**
 * Get summary of pending transcript follow-ups (for debugging/monitoring).
 */
export async function getTranscriptAutopilotStatus(): Promise<{
  pendingFollowups: number;
  recentMeetings: number;
  lastRunAt: string | null;
}> {
  const supabase = createAdminClient();

  // Count pending follow-ups
  const { count: pendingCount } = await supabase
    .from('meeting_transcriptions')
    .select('id', { count: 'exact', head: true })
    .not('analysis', 'is', null)
    .eq('follow_up_sent', false);

  // Count recent meetings (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: recentCount } = await supabase
    .from('meeting_transcriptions')
    .select('id', { count: 'exact', head: true })
    .gte('meeting_date', sevenDaysAgo.toISOString());

  // Get last run time
  const { data: lastAction } = await supabase
    .from('ai_action_log')
    .select('created_at')
    .eq('source', 'transcript')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    pendingFollowups: pendingCount || 0,
    recentMeetings: recentCount || 0,
    lastRunAt: lastAction?.created_at || null,
  };
}
