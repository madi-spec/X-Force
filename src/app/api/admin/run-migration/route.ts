import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/admin/run-migration
 *
 * Runs the collateral tables migration
 * This is a temporary endpoint for development purposes
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: { step: string; success: boolean; error?: string }[] = [];

  // Create collateral table
  const { error: e1 } = await supabase.rpc('create_collateral_table' as any);

  // Since RPC won't work for DDL, let's try inserting/checking if tables exist
  // We'll use a workaround - try to select from the tables

  // Check if collateral table exists
  const { error: checkError } = await supabase
    .from('collateral')
    .select('id')
    .limit(1);

  if (checkError?.message?.includes('does not exist')) {
    results.push({
      step: 'collateral table check',
      success: false,
      error: 'Table does not exist. Run migration via Supabase Dashboard SQL Editor.'
    });
  } else {
    results.push({
      step: 'collateral table',
      success: true
    });
  }

  // Check software_links
  const { error: swError } = await supabase
    .from('software_links')
    .select('id')
    .limit(1);

  if (swError?.message?.includes('does not exist')) {
    results.push({
      step: 'software_links table check',
      success: false,
      error: 'Table does not exist'
    });
  } else {
    results.push({
      step: 'software_links table',
      success: true
    });
  }

  // Check meeting_prep_notes
  const { error: mpError } = await supabase
    .from('meeting_prep_notes')
    .select('id')
    .limit(1);

  if (mpError?.message?.includes('does not exist')) {
    results.push({
      step: 'meeting_prep_notes table check',
      success: false,
      error: 'Table does not exist'
    });
  } else {
    results.push({
      step: 'meeting_prep_notes table',
      success: true
    });
  }

  const allSuccess = results.every(r => r.success);

  return NextResponse.json({
    success: allSuccess,
    message: allSuccess
      ? 'All tables exist'
      : 'Some tables missing. Copy migration SQL to Supabase Dashboard > SQL Editor and run it.',
    results,
    migrationFile: 'supabase/migrations/20260110000001_add_collateral_tables.sql'
  });
}
