-- Deal Room Public Access Migration
-- Enables public (unauthenticated) access to deal rooms via slug
-- and sets up storage bucket policies

-- ============================================
-- UPDATE RLS POLICIES FOR PUBLIC ACCESS
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS deal_rooms_select ON deal_rooms;
DROP POLICY IF EXISTS deal_room_assets_select ON deal_room_assets;

-- Allow public SELECT on deal_rooms by slug (for public room page)
-- Also keep authenticated access for deal owners/managers
CREATE POLICY deal_rooms_select ON deal_rooms
  FOR SELECT USING (
    -- Public access by slug (anyone with the link)
    slug IS NOT NULL
    OR
    -- Authenticated access for owners/managers
    is_manager_or_admin()
    OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_rooms.deal_id
      AND deals.owner_id = get_current_user_id()
    )
  );

-- Allow public SELECT on deal_room_assets via deal_room
CREATE POLICY deal_room_assets_select ON deal_room_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deal_rooms
      WHERE deal_rooms.id = deal_room_assets.deal_room_id
    )
  );

-- ============================================
-- STORAGE BUCKET SETUP (Manual Step Required)
-- ============================================
--
-- NOTE: Storage bucket creation must be done via Supabase Dashboard:
--
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create a new bucket called "deal-room-assets"
-- 3. Set it as a PUBLIC bucket (for read access)
-- 4. The policies below will handle upload restrictions
--
-- Alternatively, run this SQL in the Supabase SQL Editor:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('deal-room-assets', 'deal-room-assets', true)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Allow authenticated users to upload files
-- Path format: deal-rooms/{deal_room_id}/{filename}
CREATE POLICY "Authenticated users can upload deal room assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'deal-room-assets'
);

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update deal room assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'deal-room-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete deal room assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'deal-room-assets');

-- Allow public read access (since bucket is public)
CREATE POLICY "Public read access for deal room assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'deal-room-assets');

-- ============================================
-- ADD DELETE POLICY FOR DEAL ROOM ASSETS
-- ============================================

-- Allow authenticated users to delete assets from their deal rooms
CREATE POLICY deal_room_assets_delete ON deal_room_assets
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM deal_rooms
      JOIN deals ON deals.id = deal_rooms.deal_id
      WHERE deal_rooms.id = deal_room_assets.deal_room_id
      AND (
        deals.owner_id = get_current_user_id()
        OR is_manager_or_admin()
      )
    )
  );

-- Allow authenticated users to update assets in their deal rooms
CREATE POLICY deal_room_assets_update ON deal_room_assets
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM deal_rooms
      JOIN deals ON deals.id = deal_rooms.deal_id
      WHERE deal_rooms.id = deal_room_assets.deal_room_id
      AND (
        deals.owner_id = get_current_user_id()
        OR is_manager_or_admin()
      )
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY deal_rooms_select ON deal_rooms IS
  'Allows public access to deal rooms by slug for the shareable room page';

COMMENT ON POLICY deal_room_assets_select ON deal_room_assets IS
  'Allows public read of assets for accessible deal rooms';
