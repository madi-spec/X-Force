import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  findMatchingSchedulingRequest,
  processSchedulingResponse,
  type IncomingEmail,
} from '@/lib/scheduler/responseProcessor';
import { processSchedulingAutomation } from '@/lib/scheduler/automationProcessor';
import { getValidToken } from '@/lib/microsoft/auth';

/**
 * GET /api/cron/scheduler
 *
 * Unified cron job to process ALL scheduler actions.
 * Should be called every minute by an external cron service.
 *
 * This endpoint handles:
 * - process_response: Process incoming email responses
 * - follow_up, second_follow_up: Send follow-up emails
 * - send_initial, send_options: Send initial scheduling proposals
 * - send_reminder: Send meeting reminders
 * - check_no_show: Check for no-shows after meetings
 * - human_review_*: Flag for human review (no automation, just log)
 * - answer_question, clarify_response, review_counter_proposal: Human review needed
 *
 * Security: Validates CRON_SECRET header to prevent unauthorized calls
 */

/**
 * Clean email body by stripping HTML, removing security banners,
 * and extracting only the actual reply (not quoted content)
 */
function cleanEmailBody(htmlContent: string): string {
  // Security banner patterns to remove
  const securityBannerPatterns = [
    /CAUTION:\s*This email originated from outside your organization\.[\s\S]*?>>>>+/gi,
    /Exercise caution when opening attachments or clicking links[\s\S]*?>>>>+/gi,
    /<p><strong>CAUTION:<\/strong>[\s\S]*?<\/p><p>Exercise caution[\s\S]*?<\/p>/gi,
  ];

  let content = htmlContent;

  // Remove security banner patterns from HTML first
  for (const pattern of securityBannerPatterns) {
    content = content.replace(pattern, '');
  }

  // Try to extract just the reply content (before quoted text)
  // Gmail uses <div class="gmail_quote"> for quoted content
  // Outlook uses blockquote
  const replyPatterns = [
    /<div[^>]*dir="ltr"[^>]*>([\s\S]*?)<\/div>\s*(?:<br>)?\s*<div[^>]*class="gmail_quote/i,
    /<div[^>]*>([\s\S]*?)<\/div>\s*<blockquote/i,
  ];

  for (const pattern of replyPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      content = match[1];
      break;
    }
  }

  // Strip remaining HTML tags
  content = content
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

  // Final cleanup: remove any remaining security banner text
  content = content
    .replace(/CAUTION:\s*This email originated from outside your organization\.[\s\S]*?>>>>+/gi, '')
    .replace(/Exercise caution when opening attachments[\s\S]*?>>>>+/gi, '')
    .trim();

  // Strip quoted email content (plain text format)
  // Gmail: "On Mon, Jan 5, 2026 at 10:00 AM Name <email> wrote:"
  // Also handles: "On January 5, 2026 at 10:00 AM, Name wrote:"
  const plainTextQuotePatterns = [
    /\s*On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s+[^<\n]*(?:<[^>]+>)?\s*wrote:[\s\S]*/i,
    /\s*On\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?,?\s+[^\n]*wrote:[\s\S]*/i,
    /\s*-{3,}\s*(?:Original Message|Forwarded Message)\s*-{3,}[\s\S]*/i,
    /\s*From:\s+[^\n]+\s*Sent:\s+[^\n]+\s*To:\s+[^\n]+[\s\S]*/i,
  ];

  for (const pattern of plainTextQuotePatterns) {
    content = content.replace(pattern, '').trim();
  }

  return content;
}

// Action types that can be processed by automation
const AUTOMATION_ACTION_TYPES = [
  'follow_up',
  'second_follow_up',
  'send_initial',
  'send_options',
  'send_reminder',
  'check_no_show',
] as const;

// Action types that need human review (we just log and leave them)
const HUMAN_REVIEW_ACTION_TYPES = [
  'human_review_decline',
  'human_review_max_attempts',
  'human_review_confusion',
  'answer_question',
  'offer_future_scheduling',
  'review_counter_proposal',
  'clarify_response',
  'confirm_attendance',
] as const;

export async function GET(request: NextRequest) {
  // Validate cron secret - use Authorization header (same as other crons)
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    console.log('[Cron/Scheduler] Invalid or missing cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = `run_${Date.now()}`;
  const startedAt = new Date();
  console.log(`[Cron/Scheduler:${runId}] === STARTING UNIFIED SCHEDULER CRON ===`);

  const supabase = createAdminClient();

  // Log job start
  await supabase.from('cron_executions').insert({
    job_name: 'scheduler',
    started_at: startedAt.toISOString(),
    status: 'running',
    result: { run_id: runId },
  });
  const now = new Date().toISOString();
  const results: Array<{
    requestId: string;
    correlationId: string;
    title: string;
    actionType: string;
    result: string;
    error?: string;
  }> = [];

  try {
    // Find all scheduling requests that need processing
    const { data: deferredRequests, error: queryError } = await supabase
      .from('scheduling_requests')
      .select(`
        id,
        title,
        status,
        email_thread_id,
        created_by,
        next_action_type,
        next_action_at,
        timezone,
        attempt_count,
        attendees:scheduling_attendees(*)
      `)
      .in('next_action_type', [
        'process_response',
        ...AUTOMATION_ACTION_TYPES,
        ...HUMAN_REVIEW_ACTION_TYPES,
      ])
      .lte('next_action_at', now)
      .order('next_action_at', { ascending: true })
      .limit(10);

    if (queryError) {
      console.error(`[Cron/Scheduler:${runId}] Query error:`, queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!deferredRequests || deferredRequests.length === 0) {
      console.log(`[Cron/Scheduler:${runId}] No deferred tasks found`);

      // Log job completion with no tasks
      const completedAt = new Date();
      await supabase
        .from('cron_executions')
        .update({
          completed_at: completedAt.toISOString(),
          status: 'success',
          duration_ms: completedAt.getTime() - startedAt.getTime(),
          result: { run_id: runId, processed: 0, message: 'No deferred tasks' },
        })
        .eq('job_name', 'scheduler')
        .is('completed_at', null)
        .gte('started_at', new Date(startedAt.getTime() - 1000).toISOString());

      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No deferred tasks to process',
      });
    }

    console.log(`[Cron/Scheduler:${runId}] Found ${deferredRequests.length} deferred task(s)`);

    // Log summary of action types
    const actionTypeSummary = deferredRequests.reduce((acc, r) => {
      acc[r.next_action_type] = (acc[r.next_action_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[Cron/Scheduler:${runId}] Action types:`, actionTypeSummary);

    for (const request of deferredRequests) {
      const correlationId = `sched_${request.id.slice(0, 8)}_${Date.now()}`;
      const actionType = request.next_action_type;

      console.log(`[Cron/Scheduler:${correlationId}] Processing: ${request.title}`);
      console.log(`[Cron/Scheduler:${correlationId}] Action type: ${actionType}`);
      console.log(`[Cron/Scheduler:${correlationId}] Status: ${request.status}`);

      try {
        // Route to appropriate handler based on action type
        if (actionType === 'process_response') {
          // Handle email response processing
          const result = await handleProcessResponse(request, supabase, correlationId);
          results.push({
            requestId: request.id,
            correlationId,
            title: request.title,
            actionType,
            result: result.action || 'processed',
            error: result.error,
          });
        } else if (AUTOMATION_ACTION_TYPES.includes(actionType as any)) {
          // Handle automation actions (follow-up, reminders, etc.)
          const result = await handleAutomationAction(request, supabase, correlationId);
          results.push({
            requestId: request.id,
            correlationId,
            title: request.title,
            actionType,
            result: result.action || 'automated',
            error: result.error,
          });
        } else if (HUMAN_REVIEW_ACTION_TYPES.includes(actionType as any)) {
          // Human review needed - just log and skip clearing next_action
          console.log(`[Cron/Scheduler:${correlationId}] Human review required for: ${actionType}`);
          results.push({
            requestId: request.id,
            correlationId,
            title: request.title,
            actionType,
            result: 'needs_human_review',
          });
          // Don't clear next_action - leave it for dashboard visibility
          continue;
        } else {
          console.warn(`[Cron/Scheduler:${correlationId}] Unknown action type: ${actionType}`);
          results.push({
            requestId: request.id,
            correlationId,
            title: request.title,
            actionType,
            result: 'unknown_action_type',
          });
        }
      } catch (err) {
        console.error(`[Cron/Scheduler:${correlationId}] Error:`, err);
        results.push({
          requestId: request.id,
          correlationId,
          title: request.title,
          actionType,
          result: 'error',
          error: String(err),
        });
      }
    }

    console.log(`[Cron/Scheduler:${runId}] === PROCESSING COMPLETE ===`);
    console.log(`[Cron/Scheduler:${runId}] Results:`, JSON.stringify(results, null, 2));

    // Log job completion
    const completedAt = new Date();
    await supabase
      .from('cron_executions')
      .update({
        completed_at: completedAt.toISOString(),
        status: 'success',
        duration_ms: completedAt.getTime() - startedAt.getTime(),
        result: {
          run_id: runId,
          processed: results.length,
          results,
        },
      })
      .eq('job_name', 'scheduler')
      .is('completed_at', null)
      .gte('started_at', new Date(startedAt.getTime() - 1000).toISOString());

    return NextResponse.json({
      success: true,
      runId,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error(`[Cron/Scheduler:${runId}] Fatal error:`, err);

    // Log job failure
    const completedAt = new Date();
    await supabase
      .from('cron_executions')
      .update({
        completed_at: completedAt.toISOString(),
        status: 'failed',
        duration_ms: completedAt.getTime() - startedAt.getTime(),
        error_message: String(err),
        result: { run_id: runId, error: String(err) },
      })
      .eq('job_name', 'scheduler')
      .is('completed_at', null)
      .gte('started_at', new Date(startedAt.getTime() - 1000).toISOString());

    return NextResponse.json(
      { error: String(err), runId },
      { status: 500 }
    );
  }
}

/**
 * Handle process_response action - find and process incoming email
 */
async function handleProcessResponse(
  request: any,
  supabase: ReturnType<typeof createAdminClient>,
  correlationId: string
): Promise<{ action?: string; error?: string }> {
  // Clear the next_action to prevent re-processing
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: null,
      next_action_at: null,
    })
    .eq('id', request.id);

  // Find the matching inbound email
  let matchingEmail: IncomingEmail | null = null;

  // Strategy 1: Use email_thread_id to find emails in the same thread
  if (request.email_thread_id) {
    console.log(`[Cron/Scheduler:${correlationId}] Looking for email with thread_id: ${request.email_thread_id}`);

    const token = await getValidToken(request.created_by);
    if (token) {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${request.email_thread_id}'&$orderby=receivedDateTime desc&$top=1&$select=id,subject,bodyPreview,body,from,receivedDateTime,conversationId`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const msg = data.value?.[0];
        if (msg) {
          // Extract clean body content (strip HTML and security banners)
          const rawBody = msg.body?.content || msg.bodyPreview || '';
          const cleanedBody = cleanEmailBody(rawBody);

          matchingEmail = {
            id: msg.id,
            subject: msg.subject || '',
            body: cleanedBody,
            bodyPreview: msg.bodyPreview || '',
            from: {
              address: msg.from?.emailAddress?.address || '',
              name: msg.from?.emailAddress?.name || '',
            },
            receivedDateTime: msg.receivedDateTime,
            conversationId: msg.conversationId,
          };
          console.log(`[Cron/Scheduler:${correlationId}] Found email via thread_id`);
          console.log(`[Cron/Scheduler:${correlationId}] Cleaned body: ${cleanedBody.slice(0, 200)}`);
        }
      }
    }
  }

  // Strategy 2: Find from communications table if Graph API didn't work
  if (!matchingEmail) {
    console.log(`[Cron/Scheduler:${correlationId}] Trying communications table fallback`);

    const externalAttendee = request.attendees?.find(
      (a: { side: string }) => a.side === 'external'
    );

    if (externalAttendee) {
      const { data: recentEmails } = await supabase
        .from('communications')
        .select('*')
        .eq('direction', 'inbound')
        .eq('channel', 'email')
        .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('occurred_at', { ascending: false })
        .limit(20);

      const email = recentEmails?.find((e) => {
        const participants = e.their_participants as Array<{ email?: string }> | null;
        return participants?.some(
          (p) =>
            p.email?.toLowerCase() ===
            (externalAttendee as { email: string }).email.toLowerCase()
        );
      });

      if (email) {
        const participants = email.their_participants as Array<{
          email?: string;
          name?: string;
        }> | null;
        const fromParticipant = participants?.[0];

        // Extract clean body content (strip HTML and security banners)
        const rawBody = email.full_content || email.content_preview || '';
        const cleanedBody = cleanEmailBody(rawBody);

        matchingEmail = {
          id: email.external_id || email.id,
          subject: email.subject || '',
          body: cleanedBody,
          bodyPreview: email.content_preview || '',
          from: {
            address: fromParticipant?.email || '',
            name: fromParticipant?.name || '',
          },
          receivedDateTime: email.occurred_at,
          conversationId: email.thread_id,
        };
        console.log(`[Cron/Scheduler:${correlationId}] Found email via communications table`);
        console.log(`[Cron/Scheduler:${correlationId}] Cleaned body: ${cleanedBody.slice(0, 200)}`);
      }
    }
  }

  if (!matchingEmail) {
    console.log(`[Cron/Scheduler:${correlationId}] No matching email found`);
    return { action: 'no_email_found' };
  }

  console.log(`[Cron/Scheduler:${correlationId}] Processing email: ${matchingEmail.subject}`);
  console.log(`[Cron/Scheduler:${correlationId}] From: ${matchingEmail.from.address}`);

  // Process the response
  const processResult = await processSchedulingResponse(matchingEmail, request);
  console.log(`[Cron/Scheduler:${correlationId}] Result:`, processResult.action || 'processed');

  return {
    action: processResult.action || (processResult.processed ? 'processed' : 'not_processed'),
    error: processResult.error,
  };
}

/**
 * Handle automation actions (follow-up, send_initial, etc.)
 */
async function handleAutomationAction(
  request: any,
  supabase: ReturnType<typeof createAdminClient>,
  correlationId: string
): Promise<{ action?: string; error?: string }> {
  const actionType = request.next_action_type;

  console.log(`[Cron/Scheduler:${correlationId}] Executing automation: ${actionType}`);

  // Clear the next_action first to prevent re-processing
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: null,
      next_action_at: null,
    })
    .eq('id', request.id);

  try {
    // Use the existing automation processor
    // It will determine what to do based on the request's status and context
    const stats = await processSchedulingAutomation(request.created_by);

    console.log(`[Cron/Scheduler:${correlationId}] Automation stats:`, stats);

    if (stats.errors.length > 0) {
      return { action: actionType, error: stats.errors.join('; ') };
    }

    return { action: actionType };
  } catch (err) {
    console.error(`[Cron/Scheduler:${correlationId}] Automation error:`, err);
    return { action: actionType, error: String(err) };
  }
}

/**
 * POST /api/cron/scheduler
 * Alternative endpoint for services that prefer POST for cron jobs
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
