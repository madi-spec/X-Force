import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ dealId: string; assetId: string }>;
}

// PATCH - Update asset (name, order, stage_visible)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { dealId, assetId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, order, stage_visible } = body;

    // Build update object
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (order !== undefined) updates.order = order;
    if (stage_visible !== undefined) updates.stage_visible = stage_visible;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Verify asset belongs to deal's room
    const { data: dealRoom } = await supabase
      .from('deal_rooms')
      .select('id')
      .eq('deal_id', dealId)
      .single();

    if (!dealRoom) {
      return NextResponse.json({ error: 'Deal room not found' }, { status: 404 });
    }

    // Update asset
    const { data: asset, error } = await supabase
      .from('deal_room_assets')
      .update(updates)
      .eq('id', assetId)
      .eq('deal_room_id', dealRoom.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating asset:', error);
      return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Error in asset PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove asset and its file from storage
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { dealId, assetId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get deal room
    const { data: dealRoom } = await supabase
      .from('deal_rooms')
      .select('id')
      .eq('deal_id', dealId)
      .single();

    if (!dealRoom) {
      return NextResponse.json({ error: 'Deal room not found' }, { status: 404 });
    }

    // Get asset to find the storage path
    const { data: asset, error: fetchError } = await supabase
      .from('deal_room_assets')
      .select('*')
      .eq('id', assetId)
      .eq('deal_room_id', dealRoom.id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Delete from storage if it's a file (not a link)
    if (asset.type !== 'link' && asset.url) {
      // Extract path from URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/deal-room-assets/path
      const urlParts = asset.url.split('/deal-room-assets/');
      if (urlParts.length > 1) {
        const storagePath = urlParts[1];
        const { error: storageError } = await supabase.storage
          .from('deal-room-assets')
          .remove([storagePath]);

        if (storageError) {
          console.warn('Failed to delete file from storage:', storageError);
          // Continue with asset deletion even if storage deletion fails
        }
      }
    }

    // Delete asset record
    const { error: deleteError } = await supabase
      .from('deal_room_assets')
      .delete()
      .eq('id', assetId)
      .eq('deal_room_id', dealRoom.id);

    if (deleteError) {
      console.error('Error deleting asset:', deleteError);
      return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in asset DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
