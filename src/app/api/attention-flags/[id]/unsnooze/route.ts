/**
 * POST /api/attention-flags/[id]/unsnooze
 *
 * Unsnoozes an attention flag, returning it to open status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AttentionFlagMutationResponse } from '@/types/operatingLayer';

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

    // First check that the flag is actually snoozed
    const { data: existingFlag, error: fetchError } = await supabase
      .from('attention_flags')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Attention flag not found' }, { status: 404 });
      }
      throw fetchError;
    }

    if (existingFlag.status !== 'snoozed') {
      return NextResponse.json(
        { error: 'Attention flag is not snoozed' },
        { status: 400 }
      );
    }

    // Update the attention flag
    const { data: updatedFlag, error } = await supabase
      .from('attention_flags')
      .update({
        status: 'open',
        snoozed_until: null,
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
      console.error('[AttentionFlags] Error unsnoozing:', error);
      throw error;
    }

    const response: AttentionFlagMutationResponse = {
      success: true,
      flag: updatedFlag,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AttentionFlags] Unsnooze error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
