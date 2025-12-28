import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DealRoomAssetType } from '@/types';

interface RouteParams {
  params: Promise<{ dealId: string }>;
}

// GET - List assets for a deal room
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { dealId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get deal room
    const { data: dealRoom, error: roomError } = await supabase
      .from('deal_rooms')
      .select('id')
      .eq('deal_id', dealId)
      .single();

    if (roomError || !dealRoom) {
      return NextResponse.json({ error: 'Deal room not found' }, { status: 404 });
    }

    // Get assets
    const { data: assets, error } = await supabase
      .from('deal_room_assets')
      .select('*')
      .eq('deal_room_id', dealRoom.id)
      .order('order', { ascending: true });

    if (error) {
      console.error('Error fetching assets:', error);
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }

    return NextResponse.json({ assets: assets || [] });
  } catch (error) {
    console.error('Error in assets GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload new asset
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { dealId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create deal room
    let { data: dealRoom } = await supabase
      .from('deal_rooms')
      .select('id')
      .eq('deal_id', dealId)
      .single();

    if (!dealRoom) {
      // Room doesn't exist, create it first via the other endpoint
      return NextResponse.json({ error: 'Deal room not found. Create the room first.' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string;
    const type = formData.get('type') as DealRoomAssetType;
    const stageVisible = formData.get('stageVisible') as string; // JSON array
    const url = formData.get('url') as string | null; // For link type

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    let assetUrl = url || '';

    // Handle file upload for non-link types
    if (type !== 'link' && file) {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${dealRoom.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('deal-room-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('deal-room-assets')
        .getPublicUrl(fileName);

      assetUrl = publicUrl;
    } else if (type === 'link' && !url) {
      return NextResponse.json({ error: 'URL is required for link type' }, { status: 400 });
    } else if (type !== 'link' && !file) {
      return NextResponse.json({ error: 'File is required for non-link types' }, { status: 400 });
    }

    // Get current max order
    const { data: maxOrderResult } = await supabase
      .from('deal_room_assets')
      .select('order')
      .eq('deal_room_id', dealRoom.id)
      .order('order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderResult?.order ?? -1) + 1;

    // Parse stage visibility
    let stageVisibleArray: string[] = [];
    if (stageVisible) {
      try {
        stageVisibleArray = JSON.parse(stageVisible);
      } catch {
        // If parsing fails, use empty array (visible to all stages)
      }
    }

    // Create asset record
    const { data: asset, error: createError } = await supabase
      .from('deal_room_assets')
      .insert({
        deal_room_id: dealRoom.id,
        name,
        type,
        url: assetUrl,
        stage_visible: stageVisibleArray,
        order: nextOrder,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating asset:', createError);
      return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Error in assets POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
