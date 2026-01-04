import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/settings/software-links
 * List all software links
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('software_links')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[SoftwareLinks] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ links: data });
  } catch (err) {
    console.error('[SoftwareLinks] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch software links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/software-links
 * Create a new software link
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, url, icon, show_for_meeting_types, show_for_products, show_for_deal_stages } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get the max sort_order to add at the end
    const { data: maxOrder } = await adminClient
      .from('software_links')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.sort_order || 0) + 1;

    const { data, error } = await adminClient
      .from('software_links')
      .insert({
        name,
        description: description || null,
        url,
        icon: icon || null,
        show_for_meeting_types: show_for_meeting_types || [],
        show_for_products: show_for_products || [],
        show_for_deal_stages: show_for_deal_stages || [],
        is_active: true,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('[SoftwareLinks] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ link: data });
  } catch (err) {
    console.error('[SoftwareLinks] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to create software link' },
      { status: 500 }
    );
  }
}
