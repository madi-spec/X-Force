import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/settings/software-links/[id]
 * Update a software link
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      url,
      icon,
      show_for_meeting_types,
      show_for_products,
      show_for_deal_stages,
      is_active,
      sort_order,
    } = body;

    const adminClient = createAdminClient();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (url !== undefined) updates.url = url;
    if (icon !== undefined) updates.icon = icon;
    if (show_for_meeting_types !== undefined) updates.show_for_meeting_types = show_for_meeting_types;
    if (show_for_products !== undefined) updates.show_for_products = show_for_products;
    if (show_for_deal_stages !== undefined) updates.show_for_deal_stages = show_for_deal_stages;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await adminClient
      .from('software_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[SoftwareLinks] PATCH error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ link: data });
  } catch (err) {
    console.error('[SoftwareLinks] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to update software link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/software-links/[id]
 * Delete a software link
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('software_links')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SoftwareLinks] DELETE error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[SoftwareLinks] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to delete software link' },
      { status: 500 }
    );
  }
}
