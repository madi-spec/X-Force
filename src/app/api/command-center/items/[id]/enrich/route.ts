/**
 * Enrich Item API
 *
 * POST /api/command-center/items/[id]/enrich
 * Generates rich context for a command center item including:
 * - Context summary
 * - Considerations
 * - Source links
 * - Email draft
 * - Schedule suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { enrichItem } from '@/lib/commandCenter/contextEnrichment';
import { CommandCenterItem } from '@/types/commandCenter';

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

    // Get the item with related data
    const { data: item, error: itemError } = await supabase
      .from('command_center_items')
      .select(`
        *,
        deal:deals(id, name, stage, estimated_value),
        company:companies(id, name),
        contact:contacts(id, name, email, title)
      `)
      .eq('id', itemId)
      .eq('user_id', dbUser.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Enrich the item
    const enrichment = await enrichItem(dbUser.id, item as CommandCenterItem);

    // Update the item in the database with enriched data
    const { error: updateError } = await supabase
      .from('command_center_items')
      .update({
        context_summary: enrichment.context_summary,
        considerations: enrichment.considerations,
        source_links: enrichment.source_links,
        primary_contact: enrichment.primary_contact,
        email_draft: enrichment.email_draft,
        schedule_suggestions: enrichment.schedule_suggestions,
        available_actions: enrichment.available_actions,
      })
      .eq('id', itemId);

    if (updateError) {
      console.error('[Enrich] Failed to save enrichment:', updateError);
    }

    return NextResponse.json({
      success: true,
      enrichment,
    });
  } catch (error) {
    console.error('[Enrich] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enrich item' },
      { status: 500 }
    );
  }
}
