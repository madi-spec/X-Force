/**
 * POST /api/attention-flags/[id]/mark-sent
 *
 * Closes the loop after a user copies/sends an AI follow-up draft.
 * - Validates flag exists, is open, and is an applicable type
 * - Updates company_product timestamps
 * - Resolves the attention flag
 * - Optionally logs an activity record
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AttentionFlagType } from '@/types/operatingLayer';

// Valid flag types that can be marked as sent
const VALID_FLAG_TYPES: AttentionFlagType[] = [
  'STALE_IN_STAGE',
  'NO_NEXT_STEP_AFTER_MEETING',
  'GHOSTING_AFTER_PROPOSAL',
];

// Request body type
interface MarkSentRequestBody {
  channel: string;
  to: string;
  subject: string;
  body: string;
  next_step_days?: number;
}

// Response type
interface MarkSentResponse {
  success: boolean;
  resolved: boolean;
  next_step_due_at: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseClient = await createClient();

    // Authenticate user
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Verify user exists in DB
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse and validate request body
    let requestBody: MarkSentRequestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { channel, to, subject, body: messageBody, next_step_days = 3 } = requestBody;

    // Validate required fields
    const errors: string[] = [];
    if (!channel || typeof channel !== 'string') {
      errors.push('channel is required and must be a string');
    }
    if (!to || typeof to !== 'string') {
      errors.push('to is required and must be a string');
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

    // Fetch the attention flag
    const { data: flag, error: flagError } = await supabase
      .from('attention_flags')
      .select('id, status, flag_type, company_id, company_product_id')
      .eq('id', id)
      .single();

    if (flagError) {
      if (flagError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Attention flag not found' }, { status: 404 });
      }
      console.error('[MarkSent] Error fetching flag:', flagError);
      throw flagError;
    }

    // Validate flag status
    if (flag.status !== 'open') {
      return NextResponse.json(
        { error: `Attention flag must be open to mark as sent. Current status: ${flag.status}` },
        { status: 400 }
      );
    }

    // Validate flag type
    if (!VALID_FLAG_TYPES.includes(flag.flag_type as AttentionFlagType)) {
      return NextResponse.json(
        {
          error: `Invalid flag type for mark-sent. Must be one of: ${VALID_FLAG_TYPES.join(', ')}. Got: ${flag.flag_type}`,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const nextStepDueAt = new Date(now.getTime() + next_step_days * 24 * 60 * 60 * 1000);

    // Update company_product if present
    if (flag.company_product_id) {
      const { error: productError } = await supabase
        .from('company_products')
        .update({
          last_human_touch_at: now.toISOString(),
          next_step_due_at: nextStepDueAt.toISOString(),
        })
        .eq('id', flag.company_product_id);

      if (productError) {
        console.error('[MarkSent] Error updating company_product:', productError);
        throw productError;
      }
    }

    // Resolve the attention flag
    const { error: resolveError } = await supabase
      .from('attention_flags')
      .update({
        status: 'resolved',
        resolved_at: now.toISOString(),
      })
      .eq('id', id);

    if (resolveError) {
      console.error('[MarkSent] Error resolving flag:', resolveError);
      throw resolveError;
    }

    // Find contact by email if possible
    let contactId: string | null = null;
    if (flag.company_id && to) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('company_id', flag.company_id)
        .ilike('email', to)
        .single();
      contactId = contact?.id || null;
    }

    // Log to communications table
    const { error: commError } = await supabase.from('communications').insert({
      company_id: flag.company_id,
      contact_id: contactId,
      deal_id: null,
      user_id: dbUser.id,

      channel: 'email',
      direction: 'outbound',

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
          name: to,
          email: to,
          role: 'recipient',
        },
      ],

      is_ai_generated: true,
      ai_action_type: 'followup_email_manual',
      ai_initiated_by: dbUser.id,
      ai_approved_by: dbUser.id,

      occurred_at: now.toISOString(),

      subject,
      content_preview: messageBody.slice(0, 500),
      full_content: messageBody,

      source_table: 'attention_flag_followup',
      source_id: id,

      awaiting_our_response: false,
      awaiting_their_response: true,

      tags: ['daily_driver', 'followup', 'manual_send'],
      is_starred: false,
      is_archived: false,

      analysis_status: 'pending',
    });

    if (commError) {
      // Log but don't fail - communication logging is optional
      console.error('[MarkSent] Error logging communication:', commError);
    }

    const response: MarkSentResponse = {
      success: true,
      resolved: true,
      next_step_due_at: nextStepDueAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[MarkSent] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
