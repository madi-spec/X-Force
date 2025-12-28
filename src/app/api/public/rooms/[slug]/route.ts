import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET - Fetch public room by slug (no auth required)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    // Fetch deal room with assets
    const { data: dealRoom, error: roomError } = await supabase
      .from('deal_rooms')
      .select(`
        id,
        slug,
        created_at,
        deal:deals(
          id,
          name,
          company:companies(
            id,
            name,
            logo_url
          )
        )
      `)
      .eq('slug', slug)
      .single();

    if (roomError || !dealRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Fetch assets
    const { data: assets, error: assetsError } = await supabase
      .from('deal_room_assets')
      .select('*')
      .eq('deal_room_id', dealRoom.id)
      .order('order', { ascending: true });

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }

    // Extract deal and company info
    const deal = Array.isArray(dealRoom.deal) ? dealRoom.deal[0] : dealRoom.deal;
    const company = deal?.company
      ? (Array.isArray(deal.company) ? deal.company[0] : deal.company)
      : null;

    return NextResponse.json({
      room: {
        id: dealRoom.id,
        slug: dealRoom.slug,
        dealName: deal?.name || 'Deal Room',
        companyName: company?.name || null,
        companyLogo: company?.logo_url || null,
        assets: assets || [],
      },
    });
  } catch (error) {
    console.error('Error in public room GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Record a view (no auth required)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    const body = await request.json();
    const { email, name, assetId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get deal room by slug
    const { data: dealRoom, error: roomError } = await supabase
      .from('deal_rooms')
      .select('id')
      .eq('slug', slug)
      .single();

    if (roomError || !dealRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Record view
    const { data: view, error: viewError } = await supabase
      .from('deal_room_views')
      .insert({
        deal_room_id: dealRoom.id,
        asset_id: assetId || null,
        viewer_email: email,
        viewer_name: name || null,
      })
      .select()
      .single();

    if (viewError) {
      console.error('Error recording view:', viewError);
      return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
    }

    return NextResponse.json({ view });
  } catch (error) {
    console.error('Error in public room POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
