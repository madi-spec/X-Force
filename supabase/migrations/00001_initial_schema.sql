-- X-FORCE Sales Platform - Initial Schema
-- Migration: 00001_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE organization_type AS ENUM ('prospect', 'customer', 'churned');
CREATE TYPE segment AS ENUM ('smb', 'mid_market', 'enterprise', 'pe_platform', 'franchisor');
CREATE TYPE industry AS ENUM ('pest', 'lawn', 'both');
CREATE TYPE crm_platform AS ENUM ('fieldroutes', 'pestpac', 'realgreen', 'other');

CREATE TYPE contact_role AS ENUM ('decision_maker', 'influencer', 'champion', 'end_user', 'blocker');

CREATE TYPE deal_stage AS ENUM (
  'new_lead', 'qualifying', 'discovery', 'demo',
  'data_review', 'trial', 'negotiation',
  'closed_won', 'closed_lost'
);

CREATE TYPE activity_type AS ENUM ('email_sent', 'email_received', 'meeting', 'note', 'call');
CREATE TYPE sentiment AS ENUM ('positive', 'neutral', 'negative');

CREATE TYPE user_role AS ENUM ('rep', 'manager', 'admin');
CREATE TYPE user_level AS ENUM ('l1_foundation', 'l2_established', 'l3_senior');
CREATE TYPE team AS ENUM ('xrai', 'voice');

CREATE TYPE task_type AS ENUM ('follow_up', 'call', 'email', 'meeting', 'review', 'custom');
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE task_source AS ENUM ('ai_recommendation', 'manual', 'meeting_extraction', 'sequence');

CREATE TYPE deal_room_asset_type AS ENUM ('document', 'video', 'link', 'image');

-- ============================================
-- TABLES
-- ============================================

-- Users (Sales Reps)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE, -- Links to Supabase Auth
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'rep',
  level user_level NOT NULL DEFAULT 'l1_foundation',
  team team NOT NULL,
  territory TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  hire_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type organization_type NOT NULL DEFAULT 'prospect',
  segment segment NOT NULL,
  industry industry NOT NULL,
  agent_count INTEGER NOT NULL DEFAULT 0,
  crm_platform crm_platform,
  address JSONB, -- {street, city, state, zip, lat, lng}
  voice_customer BOOLEAN NOT NULL DEFAULT false,
  voice_customer_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,
  role contact_role,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deals
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'new_lead',
  health_score INTEGER NOT NULL DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
  health_factors JSONB, -- breakdown of score components
  estimated_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  products JSONB, -- {voice: boolean, platform: boolean, ai_agents: string[]}
  competitor_mentioned TEXT,
  trial_start_date DATE,
  trial_end_date DATE,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  type activity_type NOT NULL,
  subject TEXT,
  body TEXT,
  summary TEXT, -- AI-generated for meetings
  metadata JSONB, -- channel-specific data
  sentiment sentiment,
  action_items JSONB, -- extracted from meetings
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certifications (Reference Table)
CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  required_for_products TEXT[] NOT NULL DEFAULT '{}'
);

-- Rep Certifications (Junction Table)
CREATE TABLE rep_certifications (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  certified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, certification_id)
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES users(id),
  created_by UUID REFERENCES users(id), -- null = AI-created
  type task_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  source task_source NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deal Rooms
CREATE TABLE deal_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deal Room Assets
CREATE TABLE deal_room_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_room_id UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type deal_room_asset_type NOT NULL,
  url TEXT NOT NULL,
  stage_visible TEXT[] NOT NULL DEFAULT '{}',
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deal Room Views (Engagement Tracking)
CREATE TABLE deal_room_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_room_id UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES deal_room_assets(id) ON DELETE SET NULL,
  viewer_email TEXT,
  viewer_name TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER
);

-- Deal Stage History (for audit logging)
CREATE TABLE deal_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage deal_stage,
  to_stage deal_stage NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_contacts_organization ON contacts(organization_id);
CREATE INDEX idx_contacts_email ON contacts(email);

CREATE INDEX idx_deals_organization ON deals(organization_id);
CREATE INDEX idx_deals_owner ON deals(owner_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_health_score ON deals(health_score);

CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_activities_organization ON activities(organization_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_occurred_at ON activities(occurred_at);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_deal ON tasks(deal_id);
CREATE INDEX idx_tasks_due_at ON tasks(due_at);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);

CREATE INDEX idx_deal_rooms_deal ON deal_rooms(deal_id);
CREATE INDEX idx_deal_rooms_slug ON deal_rooms(slug);

CREATE INDEX idx_deal_room_views_room ON deal_room_views(deal_room_id);

CREATE INDEX idx_deal_stage_history_deal ON deal_stage_history(deal_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Track deal stage changes
CREATE OR REPLACE FUNCTION track_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO deal_stage_history (deal_id, from_stage, to_stage)
    VALUES (NEW.id, OLD.stage, NEW.stage);
    NEW.stage_entered_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_stage_change
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION track_deal_stage_change();

-- ============================================
-- SEED DATA: Certifications
-- ============================================

INSERT INTO certifications (name, description, required_for_products) VALUES
  ('voice_core', 'Voice Core Certification', ARRAY['voice']),
  ('voice_advanced', 'Voice Advanced Certification', ARRAY['voice']),
  ('xrai_performance_center', 'X-RAI Performance Center Certification', ARRAY['platform']),
  ('xrai_action_hub', 'X-RAI Action Hub Certification', ARRAY['platform']),
  ('xrai_accountability_hub', 'X-RAI Accountability Hub Certification', ARRAY['platform']),
  ('ai_agents_basic', 'AI Agents Basic Certification', ARRAY['ai_agents']),
  ('ai_agents_integrated', 'AI Agents Integrated Certification', ARRAY['ai_agents']),
  ('crm_fieldroutes', 'FieldRoutes CRM Certification', ARRAY['platform']),
  ('crm_pestpac', 'PestPac CRM Certification', ARRAY['platform']),
  ('crm_realgreen', 'RealGreen CRM Certification', ARRAY['platform']);
