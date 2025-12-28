/**
 * POST /api/attention-flags/[id]/resolve
 *
 * Resolves an attention flag, marking it as handled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AttentionFlagMutationResponse } from '@/types/operatingLayer';
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

    // Get optional resolution notes from body
    let resolution_notes: string | null = null;
    try {
      const body = await request.json();
      resolution_notes = body.resolution_notes || null;
    } catch {
      // No body provided, that's fine
    }

    // Update the attention flag
    const { data: updatedFlag, error } = await supabase
      .from('attention_flags')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
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
      console.error('[AttentionFlags] Error resolving:', error);
      throw error;
    }

    // Add note to linked communication if this flag came from a communication
    if (updatedFlag.source_type === 'communication' && updatedFlag.source_id) {
      await addCommunicationNote({
        communicationId: updatedFlag.source_id,
        userId: dbUser.id,
        content: resolution_notes || getActionDescription('resolved_flag', { flagType: updatedFlag.flag_type }),
        noteType: 'action',
        actionType: 'resolved_flag',
        attentionFlagId: id,
      });
    }

    const response: AttentionFlagMutationResponse = {
      success: true,
      flag: updatedFlag,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AttentionFlags] Resolve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
