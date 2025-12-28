/**
 * POST /api/attention-flags/[id]/snooze
 *
 * Snoozes an attention flag until a specified time.
 * Request body: { snooze_until: string (ISO timestamp), reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AttentionFlagMutationResponse,
  SnoozeAttentionFlagRequest,
} from '@/types/operatingLayer';
import { addCommunicationNote, getActionDescription } from '@/lib/communications/addNote';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Verify user exists
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    let body: SnoozeAttentionFlagRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (!body.snooze_until) {
      return NextResponse.json(
        { error: 'snooze_until is required' },
        { status: 400 }
      );
    }

    // Validate snooze_until is a valid future date
    const snoozeUntil = new Date(body.snooze_until);
    if (isNaN(snoozeUntil.getTime())) {
      return NextResponse.json(
        { error: 'snooze_until must be a valid ISO timestamp' },
        { status: 400 }
      );
    }

    if (snoozeUntil <= new Date()) {
      return NextResponse.json(
        { error: 'snooze_until must be in the future' },
        { status: 400 }
      );
    }

    // Update the attention flag
    const { data: updatedFlag, error } = await supabase
      .from('attention_flags')
      .update({
        status: 'snoozed',
        snoozed_until: body.snooze_until,
      })
      .eq('id', id)
      .select(`
        *,
        company:companies(id, name),
        company_product:company_products(
          id,
          product:products(id, name, slug)
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Attention flag not found' }, { status: 404 });
      }
      console.error('[AttentionFlags] Error snoozing:', error);
      throw error;
    }

    // Add note to linked communication if this flag came from a communication
    if (updatedFlag.source_type === 'communication' && updatedFlag.source_id) {
      const formattedDate = snoozeUntil.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      await addCommunicationNote({
        communicationId: updatedFlag.source_id,
        userId: dbUser.id,
        content: getActionDescription('snoozed', { until: formattedDate }),
        noteType: 'action',
        actionType: 'snoozed',
        attentionFlagId: id,
      });
    }

    const response: AttentionFlagMutationResponse = {
      success: true,
      flag: updatedFlag,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AttentionFlags] Snooze error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
