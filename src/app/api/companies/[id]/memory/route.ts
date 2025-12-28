import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/companies/[id]/memory
 *
 * Get account memory for a company
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get or create memory for this company
  let { data: memory } = await supabase
    .from('account_memory')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!memory) {
    // Create empty memory record
    const { data: newMemory, error } = await supabase
      .from('account_memory')
      .insert({ company_id: companyId })
      .select()
      .single();

    if (error) {
      console.error('[Memory] Error creating:', error);
      return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
    }
    memory = newMemory;
  }

  // Get recent memory updates for audit trail
  const { data: updates } = await supabase
    .from('account_memory_updates')
    .select('*, user:users(name)')
    .eq('account_memory_id', memory.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    memory,
    recentUpdates: updates || [],
  });
}

/**
 * PATCH /api/companies/[id]/memory
 *
 * Update account memory fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  // Get current memory
  let { data: memory } = await supabase
    .from('account_memory')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!memory) {
    // Create if doesn't exist
    const { data: newMemory } = await supabase
      .from('account_memory')
      .insert({ company_id: companyId })
      .select()
      .single();
    memory = newMemory;
  }

  // Track what changed for audit
  const updates: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

  const allowedFields = [
    'resonates', 'effective_angles', 'avoided', 'failed_approaches',
    'preferred_channel', 'response_pattern', 'formality_level', 'best_time_to_reach',
    'decision_style', 'typical_timeline', 'key_concerns',
    'objections_encountered', 'rapport_builders', 'personal_notes',
    'last_win_theme', 'last_loss_reason'
  ];

  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined && JSON.stringify(body[field]) !== JSON.stringify(memory[field])) {
      updates.push({
        field,
        oldValue: memory[field],
        newValue: body[field],
      });
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: 'No changes', memory });
  }

  // Update memory
  const { data: updatedMemory, error: updateError } = await supabase
    .from('account_memory')
    .update(updateData)
    .eq('id', memory.id)
    .select()
    .single();

  if (updateError) {
    console.error('[Memory] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 });
  }

  // Log updates for audit trail
  for (const update of updates) {
    await supabase.from('account_memory_updates').insert({
      account_memory_id: memory.id,
      field_updated: update.field,
      old_value: update.oldValue,
      new_value: update.newValue,
      updated_by: profile.id,
      source: body.source || 'manual',
    });
  }

  return NextResponse.json({
    message: `Updated ${updates.length} field(s)`,
    memory: updatedMemory,
    fieldsUpdated: updates.map(u => u.field),
  });
}

/**
 * POST /api/companies/[id]/memory/add
 *
 * Add an item to an array field (resonates, avoided, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const { field, value, source } = body;

  const arrayFields = [
    'resonates', 'effective_angles', 'avoided', 'failed_approaches',
    'key_concerns', 'rapport_builders', 'personal_notes', 'objections_encountered'
  ];

  if (!arrayFields.includes(field)) {
    return NextResponse.json({ error: 'Invalid field for array append' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get or create memory
  let { data: memory } = await supabase
    .from('account_memory')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!memory) {
    const { data: newMemory } = await supabase
      .from('account_memory')
      .insert({ company_id: companyId })
      .select()
      .single();
    memory = newMemory;
  }

  // Append to array
  const currentArray = memory[field] || [];
  const newArray = [...currentArray, value];

  const { data: updatedMemory, error } = await supabase
    .from('account_memory')
    .update({ [field]: newArray })
    .eq('id', memory.id)
    .select()
    .single();

  if (error) {
    console.error('[Memory] Append error:', error);
    return NextResponse.json({ error: 'Failed to append' }, { status: 500 });
  }

  // Log update
  await supabase.from('account_memory_updates').insert({
    account_memory_id: memory.id,
    field_updated: field,
    old_value: currentArray,
    new_value: newArray,
    updated_by: profile.id,
    source: source || 'manual',
  });

  return NextResponse.json({
    message: 'Added to memory',
    memory: updatedMemory,
  });
}
