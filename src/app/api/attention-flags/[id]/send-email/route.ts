/**
 * POST /api/attention-flags/[id]/send-email
 *
 * Send a follow-up email via Microsoft Graph, log the communication,
 * update pipeline timestamps, and resolve the attention flag.
 *
 * Features:
 * - Requires authenticated user with connected Microsoft account
 * - Sends email via Microsoft Graph
 * - Logs outbound communication
 * - Updates company_product timestamps (last_human_touch_at, next_step_due_at)
 * - Resolves the attention flag
 * - Idempotency: won't re-send if same email already sent for this flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasActiveConnection } from '@/lib/microsoft/auth';
import { sendEmail } from '@/lib/microsoft/sendEmail';
import { AttentionFlagType } from '@/types/operatingLayer';
import { addCommunicationNote, getActionDescription } from '@/lib/communications/addNote';
import crypto from 'crypto';

// Valid flag types for send-email action
const VALID_FLAG_TYPES: AttentionFlagType[] = [
  'STALE_IN_STAGE',
  'NO_NEXT_STEP_AFTER_MEETING',
  'GHOSTING_AFTER_PROPOSAL',
];

// Request body type
interface SendEmailRequestBody {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  next_step_days?: number;
}

// Response type
interface SendEmailResponse {
  success: boolean;
  sent: boolean;
  provider: string;
  message_id: string | null;
  resolved: boolean;
  next_step_due_at: string | null;
}

/**
 * Generate an idempotency key from flag ID, subject, and body
 */
function generateIdempotencyKey(flagId: string, subject: string, body: string): string {
  const data = `${flagId}:${subject}:${body}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flagId } = await params;
    const supabaseClient = await createClient();

    // 1. Authenticate user
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Get user profile
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Check Microsoft connection
    const isConnected = await hasActiveConnection(dbUser.id);
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Microsoft account not connected. Go to /settings/integrations.' },
        { status: 400 }
      );
    }

    // 4. Parse and validate request body
    let requestBody: SendEmailRequestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { to, cc, bcc, subject, body: messageBody, next_step_days = 3 } = requestBody;

    // Validate required fields
    const errors: string[] = [];
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      errors.push('to is required and must be a valid email address');
    }
    if (!subject || typeof subject !== 'string') {
      errors.push('subject is required and must be a string');
    }
    if (!messageBody || typeof messageBody !== 'string') {
      errors.push('body is required and must be a string');
    }
    if (next_step_days !== undefined && (typeof next_step_days !== 'number' || next_step_days < 0)) {
      errors.push('next_step_days must be a positive number');
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // 5. Fetch the attention flag
    const { data: flag, error: flagError } = await supabase
      .from('attention_flags')
      .select('id, status, flag_type, company_id, company_product_id, source_type, source_id')
      .eq('id', flagId)
      .single();

    if (flagError) {
      if (flagError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Attention flag not found' }, { status: 404 });
      }
      console.error('[SendEmail] Error fetching flag:', flagError);
      throw flagError;
    }

    // 6. Validate flag status
    if (flag.status !== 'open') {
      return NextResponse.json(
        { error: `Attention flag must be open to send email. Current status: ${flag.status}` },
        { status: 400 }
      );
    }

    // 7. Validate flag type
    if (!VALID_FLAG_TYPES.includes(flag.flag_type as AttentionFlagType)) {
      return NextResponse.json(
        {
          error: `Invalid flag type for send-email. Must be one of: ${VALID_FLAG_TYPES.join(', ')}. Got: ${flag.flag_type}`,
        },
        { status: 400 }
      );
    }

    // 8. Check idempotency - has this exact email already been sent for this flag?
    const idempotencyKey = generateIdempotencyKey(flagId, subject, messageBody);

    const { data: existingComm } = await supabase
      .from('communications')
      .select('id, external_id')
      .eq('source_table', 'attention_flag_followup')
      .eq('source_id', flagId)
      .contains('tags', [idempotencyKey])
      .single();

    if (existingComm) {
      // Already sent - return success without re-sending
      console.log(`[SendEmail] Idempotent hit: email already sent for flag ${flagId}`);
      return NextResponse.json({
        success: true,
        sent: true,
        provider: 'microsoft_graph',
        message_id: existingComm.external_id,
        resolved: true,
        next_step_due_at: null,
      });
    }

    // 9. Load additional context for logging
    let companyName: string | null = null;
    let contactId: string | null = null;
    let contactName: string | null = null;

    if (flag.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', flag.company_id)
        .single();
      companyName = company?.name || null;

      // Find contact by email
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('company_id', flag.company_id)
        .ilike('email', to)
        .single();

      if (contact) {
        contactId = contact.id;
        contactName = contact.name;
      }
    }

    // 10. Send the email via Microsoft Graph
    const allRecipients = [to];
    const sendResult = await sendEmail(
      dbUser.id,
      allRecipients,
      subject,
      messageBody,
      cc,
      false // plain text
    );

    if (!sendResult.success) {
      console.error('[SendEmail] Microsoft Graph send failed:', sendResult.error);
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send email via Microsoft Graph' },
        { status: 500 }
      );
    }

    const now = new Date();
    const nextStepDueAt = new Date(now.getTime() + next_step_days * 24 * 60 * 60 * 1000);

    // 11. Log to communications table
    const communicationData = {
      company_id: flag.company_id,
      contact_id: contactId,
      deal_id: null,
      user_id: dbUser.id,

      channel: 'email' as const,
      direction: 'outbound' as const,

      our_participants: [
        {
          user_id: dbUser.id,
          name: dbUser.full_name || dbUser.email || 'Unknown',
          email: dbUser.email,
          role: 'sender',
        },
      ],
      their_participants: [
        {
          name: contactName || to,
          email: to,
          role: 'recipient',
        },
      ],

      is_ai_generated: true,
      ai_action_type: 'followup_email',
      ai_initiated_by: dbUser.id,
      ai_approved_by: dbUser.id,

      occurred_at: now.toISOString(),

      subject,
      content_preview: messageBody.slice(0, 500),
      full_content: messageBody,
      content_html: null,
      attachments: [],

      source_table: 'attention_flag_followup',
      source_id: flagId,
      external_id: null, // Graph sendMail doesn't return message ID in basic call
      thread_id: null,

      awaiting_our_response: false,
      awaiting_their_response: true,
      response_due_by: null,
      response_sla_minutes: null,

      tags: [idempotencyKey, 'daily_driver', 'followup'],
      is_starred: false,
      is_archived: false,

      analysis_status: 'pending' as const,
    };

    const { error: commError } = await supabase
      .from('communications')
      .insert(communicationData);

    if (commError) {
      // Log but don't fail - email was sent successfully
      console.error('[SendEmail] Error logging communication:', commError);
    }

    // 12. Update company_product timestamps if present
    if (flag.company_product_id) {
      const { error: productError } = await supabase
        .from('company_products')
        .update({
          last_human_touch_at: now.toISOString(),
          next_step_due_at: nextStepDueAt.toISOString(),
        })
        .eq('id', flag.company_product_id);

      if (productError) {
        console.error('[SendEmail] Error updating company_product:', productError);
        // Don't fail - email was sent successfully
      }
    }

    // 13. Resolve the attention flag
    const { error: resolveError } = await supabase
      .from('attention_flags')
      .update({
        status: 'resolved',
        resolved_at: now.toISOString(),
        resolution_notes: 'Follow-up sent from DraftModal',
      })
      .eq('id', flagId);

    if (resolveError) {
      console.error('[SendEmail] Error resolving flag:', resolveError);
      // Don't fail - email was sent successfully
    }

    // 14. Add note to linked communication if this flag came from a communication
    if (flag.source_type === 'communication' && flag.source_id) {
      await addCommunicationNote({
        communicationId: flag.source_id,
        userId: dbUser.id,
        content: getActionDescription('sent_email', { subject }),
        noteType: 'action',
        actionType: 'sent_email',
        attentionFlagId: flagId,
      });
    }

    console.log(`[SendEmail] Successfully sent email for flag ${flagId} to ${to}`);

    const response: SendEmailResponse = {
      success: true,
      sent: true,
      provider: 'microsoft_graph',
      message_id: null,
      resolved: true,
      next_step_due_at: nextStepDueAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[SendEmail] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
