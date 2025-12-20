/**
 * Generate Email Draft API
 *
 * POST /api/command-center/items/[id]/generate-email
 * Generates an AI email draft for the command center item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { regenerateEmailDraft } from '@/lib/commandCenter/contextEnrichment';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    const supabaseClient = await createClient();
    const { data: { user: authUser } } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify item belongs to user
    const { data: item, error: itemError } = await supabase
      .from('command_center_items')
      .select('id, user_id')
      .eq('id', itemId)
      .eq('user_id', dbUser.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Regenerate email draft
    const draft = await regenerateEmailDraft(dbUser.id, itemId);

    return NextResponse.json({
      success: true,
      subject: draft.subject,
      body: draft.body,
      confidence: draft.confidence,
    });
  } catch (error) {
    console.error('[GenerateEmail] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate email draft' },
      { status: 500 }
    );
  }
}
