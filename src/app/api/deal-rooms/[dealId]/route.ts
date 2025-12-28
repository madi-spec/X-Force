import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';

interface RouteParams {
  params: Promise<{ dealId: string }>;
}

// GET - Fetch deal room with assets and analytics
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { dealId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch deal room with assets
    const { data: dealRoom, error } = await supabase
      .from('deal_rooms')
      .select(`
        *,
        assets:deal_room_assets(*)
      `)
      .eq('deal_id', dealId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Error fetching deal room:', error);
      return NextResponse.json({ error: 'Failed to fetch deal room' }, { status: 500 });
    }

    if (!dealRoom) {
      return NextResponse.json({ dealRoom: null });
    }

    // Get view analytics
    const { data: views } = await supabase
      .from('deal_room_views')
      .select('*')
      .eq('deal_room_id', dealRoom.id);

    // Calculate analytics
    const totalViews = views?.length || 0;
    const uniqueViewers = new Set(views?.map(v => v.viewer_email).filter(Boolean)).size;
    const lastViewed = views?.length
      ? views.sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())[0].viewed_at
      : null;

    // Get top viewers
    const viewerCounts: Record<string, { email: string; name: string | null; count: number }> = {};
    views?.forEach(v => {
      if (v.viewer_email) {
        if (!viewerCounts[v.viewer_email]) {
          viewerCounts[v.viewer_email] = { email: v.viewer_email, name: v.viewer_name, count: 0 };
        }
        viewerCounts[v.viewer_email].count++;
      }
    });
    const topViewers = Object.values(viewerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate per-asset view counts
    const assetViewCounts: Record<string, number> = {};
    views?.forEach(v => {
      if (v.asset_id) {
        assetViewCounts[v.asset_id] = (assetViewCounts[v.asset_id] || 0) + 1;
      }
    });

    // Sort assets by order
    const sortedAssets = dealRoom.assets?.sort((a: { order: number }, b: { order: number }) => a.order - b.order) || [];

    // Build asset views array
    const assetViews = sortedAssets
      .filter((asset: { id: string }) => assetViewCounts[asset.id])
      .map((asset: { id: string; name: string; type: string }) => ({
        assetId: asset.id,
        assetName: asset.name,
        assetType: asset.type,
        viewCount: assetViewCounts[asset.id],
      }))
      .sort((a: { viewCount: number }, b: { viewCount: number }) => b.viewCount - a.viewCount);

    return NextResponse.json({
      dealRoom: {
        ...dealRoom,
        assets: sortedAssets,
      },
      analytics: {
        totalViews,
        uniqueViewers,
        lastViewed,
        topViewers,
        assetViews,
      },
    });
  } catch (error) {
    console.error('Error in deal room GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create deal room
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { dealId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if room already exists
    const { data: existing } = await supabase
      .from('deal_rooms')
      .select('id')
      .eq('deal_id', dealId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Deal room already exists' }, { status: 400 });
    }

    // Get deal with company for slug generation
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('name, company:companies(name)')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Generate slug from company name
    const companyName = Array.isArray(deal.company)
      ? deal.company[0]?.name
      : (deal.company as { name: string } | null)?.name;

    const baseName = (companyName || deal.name || 'deal')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

    const slug = `${baseName}-${nanoid(8)}`;

    // Create deal room
    const { data: dealRoom, error: createError } = await supabase
      .from('deal_rooms')
      .insert({
        deal_id: dealId,
        slug,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating deal room:', createError);
      return NextResponse.json({ error: 'Failed to create deal room' }, { status: 500 });
    }

    return NextResponse.json({ dealRoom });
  } catch (error) {
    console.error('Error in deal room POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
