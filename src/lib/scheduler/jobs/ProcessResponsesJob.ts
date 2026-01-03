/**
 * ProcessResponsesJob - Process incoming scheduling responses
 *
 * This job:
 * 1. Finds requests with status 'awaiting_response' that have new responses
 * 2. Uses IntentDetector to understand what the person wants
 * 3. Uses TimeParser to extract times for accept/counter_propose
 * 4. Creates appropriate drafts or escalates to human review
 */

import { JobRunner, type JobContext, type ProcessingStats } from './JobRunner';
import { SCHEDULER_JOBS, type JobDefinition } from './registry';
import { STATUS, PROCESSABLE_ACTION_TYPES } from '../core/constants';
import { detectIntent, shouldEscalate } from '../processors/IntentDetector';
import { escalateToHumanReview, buildEscalationFromIntent } from '../processors/Escalation';
import { extractTimesFromText, matchToProposedTime, type TimeParseContext } from '../core/TimeParser';
import { generateDraft } from '../draftService';

export class ProcessResponsesJob extends JobRunner {
  constructor() {
    super(SCHEDULER_JOBS.PROCESS_RESPONSES.id);
  }

  protected getJobDefinition(): JobDefinition {
    return SCHEDULER_JOBS.PROCESS_RESPONSES;
  }

  protected async run(context: JobContext): Promise<ProcessingStats> {
    const stats: ProcessingStats = { processed: 0, failed: 0, skipped: 0, errors: [] };

    // Find requests with pending response processing
    const { data: requests, error } = await context.supabase
      .from('scheduling_requests')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, email, first_name, last_name, timezone)
      `)
      .eq('status', STATUS.AWAITING_RESPONSE)
      .eq('next_action_type', 'process_response')
      .lte('next_action_at', new Date().toISOString())
      .limit(50);

    if (error) {
      context.error('Failed to fetch requests', error);
      stats.errors.push(error.message);
      return stats;
    }

    if (!requests || requests.length === 0) {
      context.log('No responses to process');
      return stats;
    }

    context.log(`Found ${requests.length} responses to process`);

    for (const request of requests) {
      try {
        await this.processResponse(request, context);
        stats.processed++;
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Request ${request.id}: ${err}`);
        context.error(`Failed to process request ${request.id}`, err);
      }
    }

    return stats;
  }

  private async processResponse(request: any, context: JobContext): Promise<void> {
    context.log(`Processing response for request ${request.id}`, {
      company: request.company?.name,
    });

    // Get the latest email response
    const response = await this.getLatestResponse(request, context);
    if (!response) {
      context.log(`No response found for request ${request.id}, skipping`);
      return;
    }

    // Step 1: Detect intent
    const proposedTimes = request.proposed_times || [];
    const intentAnalysis = await detectIntent(
      response.body,
      proposedTimes,
      context.correlationId
    );

    context.log(`Intent detected: ${intentAnalysis.intent}`, {
      confidence: intentAnalysis.confidence,
      sentiment: intentAnalysis.sentiment,
    });

    // Step 2: Check if we need to escalate
    if (shouldEscalate(intentAnalysis)) {
      context.log('Escalating to human review');
      const escalation = buildEscalationFromIntent(intentAnalysis, response.body);
      await escalateToHumanReview(request, escalation, context.correlationId);
      return;
    }

    // Step 3: Handle based on intent
    switch (intentAnalysis.intent) {
      case 'accept':
        await this.handleAccept(request, response, intentAnalysis, context);
        break;
      case 'counter_propose':
        await this.handleCounterPropose(request, response, intentAnalysis, context);
        break;
      case 'decline':
        await this.handleDecline(request, response, context);
        break;
      case 'question':
        await this.handleQuestion(request, response, intentAnalysis, context);
        break;
      case 'delegate':
        await this.handleDelegation(request, response, intentAnalysis, context);
        break;
      default:
        // Escalate unclear cases
        const escalation = buildEscalationFromIntent(intentAnalysis, response.body);
        await escalateToHumanReview(request, escalation, context.correlationId);
    }
  }

  private async getLatestResponse(request: any, context: JobContext): Promise<any | null> {
    // Check for response in communications table
    const { data: comms } = await context.supabase
      .from('communications')
      .select('*')
      .eq('thread_id', request.email_thread_id)
      .eq('direction', 'inbound')
      .order('received_at', { ascending: false })
      .limit(1);

    if (comms && comms.length > 0) {
      return {
        body: comms[0].body_text || comms[0].body_html || '',
        from: comms[0].from_email,
        receivedAt: comms[0].received_at,
      };
    }

    // Fallback to pending_email_content if no comms found
    if (request.pending_email_content) {
      return {
        body: request.pending_email_content,
        from: request.contact?.email,
        receivedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  private async handleAccept(
    request: any,
    response: any,
    intentAnalysis: any,
    context: JobContext
  ): Promise<void> {
    context.log('Handling accept intent');

    // Parse the accepted time
    const contactTimezone = request.contact?.timezone || 'America/New_York';
    const proposedTimes = request.proposed_times || [];

    const parseContext: TimeParseContext = {
      timezone: contactTimezone,
      emailBody: response.body,
      proposedTimes: proposedTimes.map((t: any) => ({
        utc: t.utc || t.datetime,
        display: t.display || t.formatted,
      })),
    };

    // First try to match against proposed times (e.g., "the first one works")
    const matchedTime = matchToProposedTime(response.body, parseContext.proposedTimes || [], parseContext);

    if (matchedTime?.utc) {
      context.log(`Matched to proposed time: ${matchedTime.display}`);
      await this.confirmAcceptedTime(request, matchedTime, context);
      return;
    }

    // Fall back to extracting times from the email text
    const extractResult = await extractTimesFromText(response.body, parseContext);

    if (!extractResult.success || extractResult.times.length === 0 || !extractResult.times[0].utc) {
      context.log('Could not parse accepted time, escalating');
      const escalation = buildEscalationFromIntent(
        { ...intentAnalysis, confidence: 'low' },
        response.body
      );
      await escalateToHumanReview(request, escalation, context.correlationId);
      return;
    }

    const acceptedTime = extractResult.times[0];
    context.log(`Accepted time parsed: ${acceptedTime.display}`);

    // Confirm the accepted time
    await this.confirmAcceptedTime(request, acceptedTime, context);
  }

  private async confirmAcceptedTime(
    request: any,
    acceptedTime: { utc: Date | null; display: string },
    context: JobContext
  ): Promise<void> {
    // Create confirmation draft
    // Note: generateDraft signature is (requestId, userId, emailType)
    await generateDraft(request.id, request.created_by, 'confirmation');

    // Update request status
    await context.supabase
      .from('scheduling_requests')
      .update({
        status: STATUS.CONFIRMED,
        confirmed_time: acceptedTime.utc?.toISOString(),
        next_action_type: null,
        next_action_at: null,
      })
      .eq('id', request.id);
  }

  private async handleCounterPropose(
    request: any,
    response: any,
    intentAnalysis: any,
    context: JobContext
  ): Promise<void> {
    context.log('Handling counter-proposal intent');

    const contactTimezone = request.contact?.timezone || 'America/New_York';
    const parseContext: TimeParseContext = {
      timezone: contactTimezone,
      emailBody: response.body,
    };

    const extractResult = await extractTimesFromText(response.body, parseContext);

    if (!extractResult.success || extractResult.times.length === 0) {
      context.log('Could not parse counter-proposed times, escalating');
      const escalation = buildEscalationFromIntent(
        { ...intentAnalysis, confidence: 'low', confusionReason: 'Could not parse proposed times' },
        response.body
      );
      await escalateToHumanReview(request, escalation, context.correlationId);
      return;
    }

    const parsedTimes = extractResult.times;
    context.log(`Parsed ${parsedTimes.length} counter-proposed times`);

    // Create a draft to respond to counter-proposal
    // Note: Using 'follow_up' as the closest email type for counter-proposal responses
    // The actual content will be customized based on the counter-proposed times
    await generateDraft(request.id, request.created_by, 'follow_up');

    // Update request status
    await context.supabase
      .from('scheduling_requests')
      .update({
        status: STATUS.NEGOTIATING,
        counter_proposed_times: parsedTimes.map((t) => ({
          display: t.display,
          utc: t.utc?.toISOString(),
          timezone: t.timezone,
        })),
        next_action_type: 'review_counter_proposal',
        next_action_at: new Date().toISOString(),
      })
      .eq('id', request.id);
  }

  private async handleDecline(request: any, response: any, context: JobContext): Promise<void> {
    context.log('Handling decline intent');

    // Update request to cancelled
    await context.supabase
      .from('scheduling_requests')
      .update({
        status: STATUS.CANCELLED,
        cancellation_reason: 'Declined by contact',
        next_action_type: null,
        next_action_at: null,
      })
      .eq('id', request.id);

    // Log the action
    await context.supabase.from('scheduling_actions').insert({
      scheduling_request_id: request.id,
      action_type: 'request_declined',
      actor: 'contact',
      ai_reasoning: 'Contact declined the meeting request',
      metadata: {
        response_preview: response.body?.slice(0, 200),
        correlation_id: context.correlationId,
      },
    });
  }

  private async handleQuestion(
    request: any,
    response: any,
    intentAnalysis: any,
    context: JobContext
  ): Promise<void> {
    context.log('Handling question intent');

    // Escalate questions for human answer
    await escalateToHumanReview(
      request,
      {
        reason: 'Contact has a question that needs answering',
        code: 'question_needs_answer',
        details: {
          question: intentAnalysis.question,
          emailBody: response.body?.slice(0, 500),
        },
        suggestedAction: 'Answer the question and continue scheduling',
        priority: 'high',
      },
      context.correlationId
    );
  }

  private async handleDelegation(
    request: any,
    response: any,
    intentAnalysis: any,
    context: JobContext
  ): Promise<void> {
    context.log('Handling delegation intent', { delegateTo: intentAnalysis.delegateTo });

    if (intentAnalysis.delegateTo) {
      // We have a delegate, update the contact and continue
      await context.supabase
        .from('scheduling_requests')
        .update({
          delegate_email: intentAnalysis.delegateTo,
          next_action_type: 'send_to_delegate',
          next_action_at: new Date().toISOString(),
        })
        .eq('id', request.id);
    } else {
      // Escalate to find delegate
      await escalateToHumanReview(
        request,
        {
          reason: 'Contact delegated but no delegate contact info found',
          code: 'delegation_unclear',
          details: {
            emailBody: response.body?.slice(0, 500),
          },
          suggestedAction: 'Identify the delegate and update contact information',
          priority: 'medium',
        },
        context.correlationId
      );
    }
  }
}

// Factory function for easy instantiation
export function createProcessResponsesJob(): ProcessResponsesJob {
  return new ProcessResponsesJob();
}
