-- X-FORCE Sales Platform - Row Level Security Policies
-- Migration: 00002_row_level_security

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get the current user's ID from their auth ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get the current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get the current user's team
CREATE OR REPLACE FUNCTION get_current_user_team()
RETURNS team AS $$
  SELECT team FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is manager or admin
CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('manager', 'admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- USERS POLICIES
-- ============================================

-- Users can read all active users
CREATE POLICY users_select ON users
  FOR SELECT USING (is_active = true);

-- Only admins can insert/update users
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY users_update ON users
  FOR UPDATE USING (is_admin());

-- ============================================
-- ORGANIZATIONS POLICIES
-- ============================================

-- All authenticated users can read organizations
CREATE POLICY organizations_select ON organizations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Reps and managers can create organizations
CREATE POLICY organizations_insert ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Reps can update their deals' organizations, managers/admins can update all
CREATE POLICY organizations_update ON organizations
  FOR UPDATE USING (
    is_manager_or_admin() OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.organization_id = organizations.id
      AND deals.owner_id = get_current_user_id()
    )
  );

-- ============================================
-- CONTACTS POLICIES
-- ============================================

-- All authenticated users can read contacts
CREATE POLICY contacts_select ON contacts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Authenticated users can create contacts
CREATE POLICY contacts_insert ON contacts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Reps can update contacts for their deals' orgs
CREATE POLICY contacts_update ON contacts
  FOR UPDATE USING (
    is_manager_or_admin() OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.organization_id = contacts.organization_id
      AND deals.owner_id = get_current_user_id()
    )
  );

-- ============================================
-- DEALS POLICIES
-- ============================================

-- Reps can see their own deals, managers/admins see all
CREATE POLICY deals_select ON deals
  FOR SELECT USING (
    is_manager_or_admin() OR
    owner_id = get_current_user_id()
  );

-- Authenticated users can create deals
CREATE POLICY deals_insert ON deals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Reps can update their own deals, managers/admins can update all
CREATE POLICY deals_update ON deals
  FOR UPDATE USING (
    is_manager_or_admin() OR
    owner_id = get_current_user_id()
  );

-- ============================================
-- ACTIVITIES POLICIES
-- ============================================

-- Users can see activities for deals they own or are managers/admins
CREATE POLICY activities_select ON activities
  FOR SELECT USING (
    is_manager_or_admin() OR
    user_id = get_current_user_id() OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = activities.deal_id
      AND deals.owner_id = get_current_user_id()
    )
  );

-- Authenticated users can create activities
CREATE POLICY activities_insert ON activities
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- CERTIFICATIONS POLICIES
-- ============================================

-- Everyone can read certifications
CREATE POLICY certifications_select ON certifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can manage certifications
CREATE POLICY certifications_insert ON certifications
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY certifications_update ON certifications
  FOR UPDATE USING (is_admin());

-- ============================================
-- REP CERTIFICATIONS POLICIES
-- ============================================

-- Users can see their own certs, managers/admins see all
CREATE POLICY rep_certifications_select ON rep_certifications
  FOR SELECT USING (
    is_manager_or_admin() OR
    user_id = get_current_user_id()
  );

-- Only admins can manage rep certifications
CREATE POLICY rep_certifications_insert ON rep_certifications
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY rep_certifications_update ON rep_certifications
  FOR UPDATE USING (is_admin());

-- ============================================
-- TASKS POLICIES
-- ============================================

-- Users see tasks assigned to them, managers/admins see all
CREATE POLICY tasks_select ON tasks
  FOR SELECT USING (
    is_manager_or_admin() OR
    assigned_to = get_current_user_id()
  );

-- Authenticated users can create tasks
CREATE POLICY tasks_insert ON tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update tasks assigned to them
CREATE POLICY tasks_update ON tasks
  FOR UPDATE USING (
    is_manager_or_admin() OR
    assigned_to = get_current_user_id()
  );

-- ============================================
-- DEAL ROOMS POLICIES
-- ============================================

-- Users can see deal rooms for their deals
CREATE POLICY deal_rooms_select ON deal_rooms
  FOR SELECT USING (
    is_manager_or_admin() OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_rooms.deal_id
      AND deals.owner_id = get_current_user_id()
    )
  );

-- Authenticated users can create deal rooms
CREATE POLICY deal_rooms_insert ON deal_rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- DEAL ROOM ASSETS POLICIES
-- ============================================

-- Inherit from deal rooms
CREATE POLICY deal_room_assets_select ON deal_room_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deal_rooms
      WHERE deal_rooms.id = deal_room_assets.deal_room_id
    )
  );

CREATE POLICY deal_room_assets_insert ON deal_room_assets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- DEAL ROOM VIEWS POLICIES
-- ============================================

-- Inherit from deal rooms
CREATE POLICY deal_room_views_select ON deal_room_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deal_rooms
      WHERE deal_rooms.id = deal_room_views.deal_room_id
    )
  );

-- Anyone can insert views (prospects viewing)
CREATE POLICY deal_room_views_insert ON deal_room_views
  FOR INSERT WITH CHECK (true);

-- ============================================
-- DEAL STAGE HISTORY POLICIES
-- ============================================

-- Same as deals
CREATE POLICY deal_stage_history_select ON deal_stage_history
  FOR SELECT USING (
    is_manager_or_admin() OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_stage_history.deal_id
      AND deals.owner_id = get_current_user_id()
    )
  );
