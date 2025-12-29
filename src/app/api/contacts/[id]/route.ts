import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/contacts/[id]
 *
 * Get a single contact by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: contact, error } = await supabase
    .from('contacts')
    .select(`
      id,
      name,
      email,
      phone,
      title,
      role,
      company_id,
      linkedin_url,
      seniority,
      department,
      source,
      notes,
      company:companies(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  return NextResponse.json(contact);
}

/**
 * PATCH /api/contacts/[id]
 *
 * Update a contact
 * Body can contain any of:
 * {
 *   name?: string,
 *   email?: string,
 *   phone?: string,
 *   title?: string,
 *   role?: string,
 *   linkedin_url?: string,
 *   seniority?: string,
 *   department?: string,
 *   notes?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = [
    'name',
    'email',
    'phone',
    'title',
    'role',
    'linkedin_url',
    'seniority',
    'department',
    'notes',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field] === '' ? null : body[field];
    }
  }

  // Normalize email to lowercase
  if (updates.email && typeof updates.email === 'string') {
    updates.email = updates.email.toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select(`
      id,
      name,
      email,
      phone,
      title,
      role,
      company_id,
      linkedin_url,
      seniority,
      department,
      source,
      notes,
      company:companies(id, name)
    `)
    .single();

  if (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }

  return NextResponse.json(contact);
}

/**
 * DELETE /api/contacts/[id]
 *
 * Delete a contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
