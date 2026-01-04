import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCollateralFileUrlServer } from '@/lib/collateral/storage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/collateral/[id]
 *
 * Get a single collateral item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: collateral, error } = await supabase
    .from('collateral')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching collateral:', error);
    return NextResponse.json({ error: 'Collateral not found' }, { status: 404 });
  }

  // Generate signed URL for file if it has a file_path
  let fileUrl = null;
  if (collateral.file_path) {
    fileUrl = await getCollateralFileUrlServer(collateral.file_path);
  }

  return NextResponse.json({
    collateral: {
      ...collateral,
      file_url: fileUrl,
    },
  });
}

/**
 * PATCH /api/collateral/[id]
 *
 * Update a collateral item
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  // Check if user owns this collateral
  const { data: existing } = await supabase
    .from('collateral')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Collateral not found' }, { status: 404 });
  }

  // Allow update if user owns it or is admin (for now, allow all authenticated users)
  // In production, add role-based check here

  // Extract updatable fields
  const {
    name,
    description,
    external_url,
    document_type,
    meeting_types,
    products,
    industries,
    company_sizes,
    visibility,
  } = body;

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (external_url !== undefined) updateData.external_url = external_url;
  if (document_type !== undefined) updateData.document_type = document_type;
  if (meeting_types !== undefined) updateData.meeting_types = meeting_types;
  if (products !== undefined) updateData.products = products;
  if (industries !== undefined) updateData.industries = industries;
  if (company_sizes !== undefined) updateData.company_sizes = company_sizes;
  if (visibility !== undefined) updateData.visibility = visibility;

  const { data: collateral, error } = await supabase
    .from('collateral')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating collateral:', error);
    return NextResponse.json({ error: 'Failed to update collateral' }, { status: 500 });
  }

  return NextResponse.json({ collateral });
}

/**
 * DELETE /api/collateral/[id]
 *
 * Archive (soft delete) a collateral item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get existing to check ownership and file path
  const { data: existing } = await supabase
    .from('collateral')
    .select('created_by, file_path')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Collateral not found' }, { status: 404 });
  }

  // Soft delete by setting archived_at
  const { error } = await supabase
    .from('collateral')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error archiving collateral:', error);
    return NextResponse.json({ error: 'Failed to archive collateral' }, { status: 500 });
  }

  // Optionally delete the file from storage (uncomment if you want hard delete of files)
  // if (existing.file_path) {
  //   await deleteCollateralFileServer(existing.file_path);
  // }

  return NextResponse.json({ success: true, message: 'Collateral archived' });
}
