-- X-FORCE Sales Platform - Comprehensive Seed Data
-- Migration: 00009_comprehensive_seed
--
-- Creates realistic test data for all features including:
-- - Sales team users with certifications
-- - Companies (customers, prospects, cold leads, churned)
-- - Contacts with various roles
-- - Deals across all pipeline stages
-- - Activities with realistic timestamps
-- - Company products and product history
-- - Deal collaborators and company watchers
-- - AI-detected signals

-- ============================================
-- CLEANUP: Remove existing test data
-- ============================================

-- Disable triggers temporarily for cleanup
ALTER TABLE company_products DISABLE TRIGGER company_products_status_change;
ALTER TABLE deals DISABLE TRIGGER deals_auto_watch;

-- Delete in reverse dependency order
DELETE FROM company_signals;
DELETE FROM company_watchers;
DELETE FROM deal_collaborators;
DELETE FROM company_product_history;
DELETE FROM company_products;
DELETE FROM deal_stage_history;
DELETE FROM activities;
DELETE FROM tasks;
DELETE FROM deal_room_views;
DELETE FROM deal_room_assets;
DELETE FROM deal_rooms;
DELETE FROM deals;
DELETE FROM contacts;
DELETE FROM companies;
DELETE FROM rep_certifications;
DELETE FROM users;

-- Re-enable triggers
ALTER TABLE company_products ENABLE TRIGGER company_products_status_change;
ALTER TABLE deals ENABLE TRIGGER deals_auto_watch;

-- ============================================
-- 1. USERS (Sales Team)
-- ============================================

-- Voice Outside Sales Team
INSERT INTO users (id, email, name, role, level, team, territory, hire_date) VALUES
  ('11111111-1111-1111-1111-111111111001', 'michael.torres@voiceforpest.com', 'Michael Torres', 'rep', 'l3_senior', 'voice', 'Southeast', '2022-03-15'),
  ('11111111-1111-1111-1111-111111111002', 'raymond.silva@voiceforpest.com', 'Raymond Silva', 'rep', 'l2_established', 'voice', 'Texas', '2023-06-01'),
  ('11111111-1111-1111-1111-111111111003', 'cabrin.james@voiceforpest.com', 'Cabrin James', 'rep', 'l2_established', 'voice', 'Southwest', '2023-08-15'),
  ('11111111-1111-1111-1111-111111111004', 'doug.patterson@voiceforpest.com', 'Doug Patterson', 'rep', 'l3_senior', 'voice', 'Southeast', '2021-11-01');

-- Voice Inside Sales Team
INSERT INTO users (id, email, name, role, level, team, territory, hire_date) VALUES
  ('11111111-1111-1111-1111-111111111005', 'kayla.martinez@voiceforpest.com', 'Kayla Martinez', 'rep', 'l2_established', 'voice', NULL, '2023-04-01'),
  ('11111111-1111-1111-1111-111111111006', 'alyssa.chen@voiceforpest.com', 'Alyssa Chen', 'rep', 'l2_established', 'voice', NULL, '2023-05-15'),
  ('11111111-1111-1111-1111-111111111007', 'rachel.thompson@voiceforpest.com', 'Rachel Thompson', 'rep', 'l1_foundation', 'voice', NULL, '2024-09-01');

-- X-RAI Team
INSERT INTO users (id, email, name, role, level, team, territory, hire_date) VALUES
  ('11111111-1111-1111-1111-111111111008', 'brent.williams@xrailabs.com', 'Brent Williams', 'rep', 'l3_senior', 'xrai', 'National', '2022-01-10'),
  ('11111111-1111-1111-1111-111111111009', 'madi.chen@xrailabs.com', 'Madi Chen', 'admin', 'l3_senior', 'xrai', 'National', '2021-08-01');

-- ============================================
-- 2. REP CERTIFICATIONS
-- ============================================

-- Get certification IDs and assign them
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111001', id, '2022-06-01' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111001', id, '2022-09-01' FROM certifications WHERE name = 'voice_advanced';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111001', id, '2023-01-15' FROM certifications WHERE name = 'xrai_performance_center';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111001', id, '2023-03-01' FROM certifications WHERE name = 'ai_agents_basic';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111001', id, '2022-07-01' FROM certifications WHERE name = 'crm_fieldroutes';

-- Raymond Silva certifications
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111002', id, '2023-08-01' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111002', id, '2023-10-01' FROM certifications WHERE name = 'crm_fieldroutes';

-- Cabrin James certifications
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111003', id, '2023-10-15' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111003', id, '2024-01-01' FROM certifications WHERE name = 'crm_pestpac';

-- Doug Patterson certifications (all)
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2022-02-01' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2022-05-01' FROM certifications WHERE name = 'voice_advanced';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2022-08-01' FROM certifications WHERE name = 'xrai_performance_center';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2022-10-01' FROM certifications WHERE name = 'xrai_action_hub';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2023-01-01' FROM certifications WHERE name = 'ai_agents_basic';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2023-04-01' FROM certifications WHERE name = 'ai_agents_integrated';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2022-03-01' FROM certifications WHERE name = 'crm_fieldroutes';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111004', id, '2022-06-01' FROM certifications WHERE name = 'crm_realgreen';

-- Inside sales certifications
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111005', id, '2023-06-01' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111006', id, '2023-07-15' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111007', id, '2024-10-01' FROM certifications WHERE name = 'voice_core';

-- Brent Williams certifications (all X-RAI)
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111008', id, '2022-04-01' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111008', id, '2022-06-01' FROM certifications WHERE name = 'xrai_performance_center';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111008', id, '2022-07-01' FROM certifications WHERE name = 'xrai_action_hub';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111008', id, '2022-08-01' FROM certifications WHERE name = 'xrai_accountability_hub';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111008', id, '2022-10-01' FROM certifications WHERE name = 'ai_agents_basic';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111008', id, '2023-01-01' FROM certifications WHERE name = 'ai_agents_integrated';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111008', id, '2022-05-01' FROM certifications WHERE name = 'crm_fieldroutes';

-- Madi Chen certifications (all)
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2021-10-01' FROM certifications WHERE name = 'voice_core';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2021-12-01' FROM certifications WHERE name = 'voice_advanced';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2022-02-01' FROM certifications WHERE name = 'xrai_performance_center';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2022-03-01' FROM certifications WHERE name = 'xrai_action_hub';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2022-04-01' FROM certifications WHERE name = 'xrai_accountability_hub';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2022-06-01' FROM certifications WHERE name = 'ai_agents_basic';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2022-09-01' FROM certifications WHERE name = 'ai_agents_integrated';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2021-11-01' FROM certifications WHERE name = 'crm_fieldroutes';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2022-01-01' FROM certifications WHERE name = 'crm_pestpac';
INSERT INTO rep_certifications (user_id, certification_id, certified_at)
SELECT '11111111-1111-1111-1111-111111111009', id, '2022-05-01' FROM certifications WHERE name = 'crm_realgreen';

-- ============================================
-- 3. COMPANIES
-- ============================================

-- CUSTOMERS (have active products)
INSERT INTO companies (id, name, status, segment, industry, agent_count, crm_platform, address, voice_customer, voice_customer_since, external_ids) VALUES
  -- ABC Pest Control - mid_market customer
  ('22222222-2222-2222-2222-222222222001', 'ABC Pest Control', 'customer', 'mid_market', 'pest', 12, 'fieldroutes',
   '{"street": "4521 Commerce Way", "city": "Tampa", "state": "FL", "zip": "33619"}',
   true, '2024-03-15', '{"voice_billing_id": "VB-10042", "fieldroutes_id": "FR-8891"}'),

  -- Sunshine Exterminators - smb customer
  ('22222222-2222-2222-2222-222222222002', 'Sunshine Exterminators', 'customer', 'smb', 'pest', 5, 'pestpac',
   '{"street": "892 Orange Ave", "city": "Orlando", "state": "FL", "zip": "32801"}',
   true, '2024-01-10', '{"voice_billing_id": "VB-10089"}'),

  -- Gulf Coast Pest Services - enterprise customer
  ('22222222-2222-2222-2222-222222222003', 'Gulf Coast Pest Services', 'customer', 'enterprise', 'pest', 45, 'fieldroutes',
   '{"street": "12000 Energy Corridor", "city": "Houston", "state": "TX", "zip": "77077"}',
   true, '2023-06-01', '{"voice_billing_id": "VB-8834", "fieldroutes_id": "FR-7712", "ats_customer_id": "GC-2023"}'),

  -- Premier Lawn & Pest - mid_market customer
  ('22222222-2222-2222-2222-222222222004', 'Premier Lawn & Pest', 'customer', 'mid_market', 'both', 18, 'realgreen',
   '{"street": "3344 Peachtree Rd", "city": "Atlanta", "state": "GA", "zip": "30326"}',
   true, '2023-09-01', '{"voice_billing_id": "VB-9156"}'),

  -- BugBusters Inc - smb customer (no open deals - upsell candidate)
  ('22222222-2222-2222-2222-222222222005', 'BugBusters Inc', 'customer', 'smb', 'pest', 4, 'pestpac',
   '{"street": "1567 Desert View Dr", "city": "Phoenix", "state": "AZ", "zip": "85034"}',
   true, '2024-11-01', '{"voice_billing_id": "VB-10234"}'),

  -- Court Pest Management - mid_market customer
  ('22222222-2222-2222-2222-222222222006', 'Court Pest Management', 'customer', 'mid_market', 'pest', 15, 'fieldroutes',
   '{"street": "8900 Preston Rd", "city": "Dallas", "state": "TX", "zip": "75225"}',
   true, '2024-02-15', '{"voice_billing_id": "VB-10012", "fieldroutes_id": "FR-9023"}'),

  -- Evergreen Lawn Care - enterprise customer (fully sold reference account)
  ('22222222-2222-2222-2222-222222222007', 'Evergreen Lawn Care', 'customer', 'enterprise', 'lawn', 38, 'realgreen',
   '{"street": "5600 Park South Dr", "city": "Charlotte", "state": "NC", "zip": "28210"}',
   true, '2023-04-01', '{"voice_billing_id": "VB-8956", "ats_customer_id": "EG-2023"}'),

  -- Excel Pest Solutions - mid_market customer (the "Raymond conflict" account)
  ('22222222-2222-2222-2222-222222222008', 'Excel Pest Solutions', 'customer', 'mid_market', 'pest', 22, 'pestpac',
   '{"street": "2100 Blake St", "city": "Denver", "state": "CO", "zip": "80205"}',
   true, '2024-08-01', '{"voice_billing_id": "VB-10198"}');

-- PROSPECTS (in active sales cycle)
INSERT INTO companies (id, name, status, segment, industry, agent_count, crm_platform, address, voice_customer, voice_customer_since, external_ids) VALUES
  -- Blue Beetle Pest Control - churned 2 years ago, now prospect again
  ('22222222-2222-2222-2222-222222222009', 'Blue Beetle Pest Control', 'prospect', 'mid_market', 'pest', 16, 'fieldroutes',
   '{"street": "7788 Biscayne Blvd", "city": "Miami", "state": "FL", "zip": "33138"}',
   false, NULL, '{"fieldroutes_id": "FR-6543"}'),

  -- Green Guard Services - PE-backed enterprise prospect
  ('22222222-2222-2222-2222-222222222010', 'Green Guard Services', 'prospect', 'enterprise', 'both', 52, 'fieldroutes',
   '{"street": "1200 Broadway", "city": "Nashville", "state": "TN", "zip": "37203"}',
   false, NULL, '{"fieldroutes_id": "FR-9501"}'),

  -- Critter Control Plus - smb prospect
  ('22222222-2222-2222-2222-222222222011', 'Critter Control Plus', 'prospect', 'smb', 'pest', 6, 'pestpac',
   '{"street": "4455 Fredericksburg Rd", "city": "San Antonio", "state": "TX", "zip": "78201"}',
   false, NULL, NULL);

-- COLD LEADS (not yet engaged)
INSERT INTO companies (id, name, status, segment, industry, agent_count, crm_platform, address, voice_customer, voice_customer_since, external_ids) VALUES
  -- Nature's Defense Pest - trade show lead
  ('22222222-2222-2222-2222-222222222012', 'Natures Defense Pest', 'cold_lead', 'smb', 'pest', 3, NULL,
   '{"street": "1100 Congress Ave", "city": "Austin", "state": "TX", "zip": "78701"}',
   false, NULL, NULL),

  -- Metro Mosquito Control - website form lead
  ('22222222-2222-2222-2222-222222222013', 'Metro Mosquito Control', 'cold_lead', 'mid_market', 'pest', 14, 'fieldroutes',
   '{"street": "333 Canal St", "city": "New Orleans", "state": "LA", "zip": "70130"}',
   false, NULL, '{"fieldroutes_id": "FR-NEW1"}'),

  -- SafeHome Exterminators - referral lead
  ('22222222-2222-2222-2222-222222222014', 'SafeHome Exterminators', 'cold_lead', 'smb', 'pest', 7, 'pestpac',
   '{"street": "2200 5th Ave N", "city": "Birmingham", "state": "AL", "zip": "35203"}',
   false, NULL, NULL);

-- CHURNED (lost customers)
INSERT INTO companies (id, name, status, segment, industry, agent_count, crm_platform, address, voice_customer, voice_customer_since, external_ids) VALUES
  -- Apex Pest Solutions - churned August 2024
  ('22222222-2222-2222-2222-222222222015', 'Apex Pest Solutions', 'churned', 'mid_market', 'pest', 11, 'fieldroutes',
   '{"street": "900 Market St", "city": "Knoxville", "state": "TN", "zip": "37902"}',
   false, '2023-01-15', '{"voice_billing_id": "VB-CHURNED-8812"}');

-- ============================================
-- 4. CONTACTS
-- ============================================

-- ABC Pest Control (4 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333001', '22222222-2222-2222-2222-222222222001', 'John Smith', 'john.smith@abcpest.com', '813-555-0101', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333002', '22222222-2222-2222-2222-222222222001', 'Sarah Johnson', 'sarah.johnson@abcpest.com', '813-555-0102', 'Operations Manager', 'influencer', false),
  ('33333333-3333-3333-3333-333333333003', '22222222-2222-2222-2222-222222222001', 'Mike Davis', 'mike.davis@abcpest.com', '813-555-0103', 'Call Center Supervisor', 'end_user', false),
  ('33333333-3333-3333-3333-333333333004', '22222222-2222-2222-2222-222222222001', 'Lisa Wong', 'lisa.wong@abcpest.com', '813-555-0104', 'Office Manager', 'end_user', false);

-- Sunshine Exterminators (2 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333005', '22222222-2222-2222-2222-222222222002', 'Carlos Rivera', 'carlos@sunshineext.com', '407-555-0201', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333006', '22222222-2222-2222-2222-222222222002', 'Maria Rivera', 'maria@sunshineext.com', '407-555-0202', 'Office Manager', 'influencer', false);

-- Gulf Coast Pest Services (5 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333007', '22222222-2222-2222-2222-222222222003', 'Robert Chen', 'rchen@gulfcoastpest.com', '713-555-0301', 'CEO', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333008', '22222222-2222-2222-2222-222222222003', 'Amanda Foster', 'afoster@gulfcoastpest.com', '713-555-0302', 'COO', 'decision_maker', false),
  ('33333333-3333-3333-3333-333333333009', '22222222-2222-2222-2222-222222222003', 'David Park', 'dpark@gulfcoastpest.com', '713-555-0303', 'IT Director', 'influencer', false),
  ('33333333-3333-3333-3333-333333333010', '22222222-2222-2222-2222-222222222003', 'Jennifer Adams', 'jadams@gulfcoastpest.com', '713-555-0304', 'Call Center Manager', 'champion', false),
  ('33333333-3333-3333-3333-333333333011', '22222222-2222-2222-2222-222222222003', 'Tom Wilson', 'twilson@gulfcoastpest.com', '713-555-0305', 'CFO', 'influencer', false);

-- Premier Lawn & Pest (3 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333012', '22222222-2222-2222-2222-222222222004', 'James Mitchell', 'james@premierlawn.com', '404-555-0401', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333013', '22222222-2222-2222-2222-222222222004', 'Patricia Mitchell', 'patricia@premierlawn.com', '404-555-0402', 'Co-Owner', 'decision_maker', false),
  ('33333333-3333-3333-3333-333333333014', '22222222-2222-2222-2222-222222222004', 'Kevin Brown', 'kevin@premierlawn.com', '404-555-0403', 'Service Manager', 'end_user', false);

-- BugBusters Inc (2 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333015', '22222222-2222-2222-2222-222222222005', 'Tony Marchetti', 'tony@bugbustersinc.com', '602-555-0501', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333016', '22222222-2222-2222-2222-222222222005', 'Nancy Marchetti', 'nancy@bugbustersinc.com', '602-555-0502', 'Office Manager', 'influencer', false);

-- Court Pest Management (3 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333017', '22222222-2222-2222-2222-222222222006', 'William Court', 'wcourt@courtpest.com', '214-555-0601', 'President', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333018', '22222222-2222-2222-2222-222222222006', 'Sandra Lee', 'slee@courtpest.com', '214-555-0602', 'Operations Director', 'influencer', false),
  ('33333333-3333-3333-3333-333333333019', '22222222-2222-2222-2222-222222222006', 'Mark Thompson', 'mthompson@courtpest.com', '214-555-0603', 'Call Center Lead', 'champion', false);

-- Evergreen Lawn Care (4 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333020', '22222222-2222-2222-2222-222222222007', 'Elizabeth Green', 'egreen@evergreenlawn.com', '704-555-0701', 'CEO', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333021', '22222222-2222-2222-2222-222222222007', 'Michael Roberts', 'mroberts@evergreenlawn.com', '704-555-0702', 'VP Operations', 'influencer', false),
  ('33333333-3333-3333-3333-333333333022', '22222222-2222-2222-2222-222222222007', 'Susan Taylor', 'staylor@evergreenlawn.com', '704-555-0703', 'Customer Service Director', 'champion', false),
  ('33333333-3333-3333-3333-333333333023', '22222222-2222-2222-2222-222222222007', 'Brian Clark', 'bclark@evergreenlawn.com', '704-555-0704', 'IT Manager', 'end_user', false);

-- Excel Pest Solutions (3 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333024', '22222222-2222-2222-2222-222222222008', 'Daniel Wright', 'dwright@excelpest.com', '303-555-0801', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333025', '22222222-2222-2222-2222-222222222008', 'Rebecca Hall', 'rhall@excelpest.com', '303-555-0802', 'Operations Manager', 'influencer', false),
  ('33333333-3333-3333-3333-333333333026', '22222222-2222-2222-2222-222222222008', 'Chris Martinez', 'cmartinez@excelpest.com', '303-555-0803', 'Call Center Manager', 'end_user', false);

-- Blue Beetle Pest Control (3 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333027', '22222222-2222-2222-2222-222222222009', 'Richard Lopez', 'rlopez@bluebeetle.com', '305-555-0901', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333028', '22222222-2222-2222-2222-222222222009', 'Angela Santos', 'asantos@bluebeetle.com', '305-555-0902', 'General Manager', 'influencer', false),
  ('33333333-3333-3333-3333-333333333029', '22222222-2222-2222-2222-222222222009', 'Jorge Mendez', 'jmendez@bluebeetle.com', '305-555-0903', 'Office Manager', 'end_user', false);

-- Green Guard Services (4 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333030', '22222222-2222-2222-2222-222222222010', 'Katherine Shaw', 'kshaw@greenguard.com', '615-555-1001', 'CEO', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333031', '22222222-2222-2222-2222-222222222010', 'Thomas Reed', 'treed@greenguard.com', '615-555-1002', 'COO', 'decision_maker', false),
  ('33333333-3333-3333-3333-333333333032', '22222222-2222-2222-2222-222222222010', 'Nicole Barnes', 'nbarnes@greenguard.com', '615-555-1003', 'VP Technology', 'influencer', false),
  ('33333333-3333-3333-3333-333333333033', '22222222-2222-2222-2222-222222222010', 'Steven Morris', 'smorris@greenguard.com', '615-555-1004', 'CFO', 'blocker', false);

-- Critter Control Plus (2 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333034', '22222222-2222-2222-2222-222222222011', 'Bob Henderson', 'bob@crittercontrolplus.com', '210-555-1101', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333035', '22222222-2222-2222-2222-222222222011', 'Linda Henderson', 'linda@crittercontrolplus.com', '210-555-1102', 'Office Manager', 'influencer', false);

-- Nature's Defense Pest (1 contact)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333036', '22222222-2222-2222-2222-222222222012', 'Gary Newman', 'gary@naturesdefense.com', '512-555-1201', 'Owner', 'decision_maker', true);

-- Metro Mosquito Control (2 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333037', '22222222-2222-2222-2222-222222222013', 'Paul Dubois', 'paul@metromosquito.com', '504-555-1301', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333038', '22222222-2222-2222-2222-222222222013', 'Marie Dubois', 'marie@metromosquito.com', '504-555-1302', 'General Manager', 'influencer', false);

-- SafeHome Exterminators (2 contacts)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333039', '22222222-2222-2222-2222-222222222014', 'Frank Walker', 'frank@safehomeext.com', '205-555-1401', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333040', '22222222-2222-2222-2222-222222222014', 'Helen Walker', 'helen@safehomeext.com', '205-555-1402', 'Office Manager', 'influencer', false);

-- Apex Pest Solutions (2 contacts - churned)
INSERT INTO contacts (id, company_id, name, email, phone, title, role, is_primary) VALUES
  ('33333333-3333-3333-3333-333333333041', '22222222-2222-2222-2222-222222222015', 'George Peters', 'gpeters@apexpest.com', '865-555-1501', 'Owner', 'decision_maker', true),
  ('33333333-3333-3333-3333-333333333042', '22222222-2222-2222-2222-222222222015', 'Donna Peters', 'dpeters@apexpest.com', '865-555-1502', 'Office Manager', 'influencer', false);

-- ============================================
-- 5. DEALS
-- ============================================

-- Get product category IDs for reference
-- voice_phone_system, voice_addons, xrai_platform, xrai_ai_agents

-- ABC Pest Control - 2 open deals
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, trial_start_date, trial_end_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444001',
  '22222222-2222-2222-2222-222222222001',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'AI Agent - Receptionist',
  'trial',
  'upsell',
  'xrai',
  78,
  4200,
  CURRENT_DATE + INTERVAL '14 days',
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '11 days',
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE - INTERVAL '21 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'receptionist_agent')
FROM product_categories pc WHERE pc.name = 'xrai_ai_agents';

INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444002',
  '22222222-2222-2222-2222-222222222001',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'AI Agent - Termite Campaign',
  'discovery',
  'upsell',
  'xrai',
  65,
  3600,
  CURRENT_DATE + INTERVAL '45 days',
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '18 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'outbound_sales_agent')
FROM product_categories pc WHERE pc.name = 'xrai_ai_agents';

-- Sunshine Exterminators - 1 open deal
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444003',
  '22222222-2222-2222-2222-222222222002',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'X-RAI Platform',
  'demo',
  'cross_sell',
  'xrai',
  82,
  9000,
  CURRENT_DATE + INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE - INTERVAL '14 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('performance_center', 'action_hub'))
FROM product_categories pc WHERE pc.name = 'xrai_platform';

-- Gulf Coast Pest Services - 1 big deal
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444004',
  '22222222-2222-2222-2222-222222222003',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'AI Agents - Full Suite',
  'negotiation',
  'expansion',
  'xrai',
  71,
  24000,
  CURRENT_DATE + INTERVAL '21 days',
  CURRENT_DATE - INTERVAL '8 days',
  CURRENT_DATE - INTERVAL '45 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('receptionist_agent', 'dispatch_agent', 'outbound_sales_agent', 'billing_agent'))
FROM product_categories pc WHERE pc.name = 'xrai_ai_agents';

-- Premier Lawn & Pest - 1 deal
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444005',
  '22222222-2222-2222-2222-222222222004',
  '11111111-1111-1111-1111-111111111009', -- Madi
  'Action Hub',
  'discovery',
  'upsell',
  'xrai',
  55,
  3300,
  CURRENT_DATE + INTERVAL '60 days',
  CURRENT_DATE - INTERVAL '12 days',
  CURRENT_DATE - INTERVAL '20 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'action_hub')
FROM product_categories pc WHERE pc.name = 'xrai_platform';

-- Court Pest Management - 2 deals
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, trial_start_date, trial_end_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444006',
  '22222222-2222-2222-2222-222222222006',
  '11111111-1111-1111-1111-111111111009', -- Madi
  'Receptionist Agent',
  'trial',
  'upsell',
  'xrai',
  85,
  4200,
  CURRENT_DATE + INTERVAL '10 days',
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '9 days',
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '25 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'receptionist_agent')
FROM product_categories pc WHERE pc.name = 'xrai_ai_agents';

INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444007',
  '22222222-2222-2222-2222-222222222006',
  '11111111-1111-1111-1111-111111111009', -- Madi
  'Termite Outbound Campaign',
  'qualifying',
  'upsell',
  'xrai',
  60,
  5400,
  CURRENT_DATE + INTERVAL '75 days',
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE - INTERVAL '10 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'outbound_sales_agent')
FROM product_categories pc WHERE pc.name = 'xrai_ai_agents';

-- Excel Pest Solutions - the conflict deal
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444008',
  '22222222-2222-2222-2222-222222222008',
  '11111111-1111-1111-1111-111111111009', -- Madi
  'AI Agent - After Hours',
  'negotiation',
  'upsell',
  'xrai',
  45,
  4800,
  CURRENT_DATE + INTERVAL '14 days',
  CURRENT_DATE - INTERVAL '10 days',
  CURRENT_DATE - INTERVAL '35 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'receptionist_agent')
FROM product_categories pc WHERE pc.name = 'xrai_ai_agents';

-- Blue Beetle Pest Control - winback deal
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444009',
  '22222222-2222-2222-2222-222222222009',
  '11111111-1111-1111-1111-111111111001', -- Michael
  'Voice + Platform',
  'discovery',
  'new_business',
  'voice_outside',
  70,
  18000,
  CURRENT_DATE + INTERVAL '45 days',
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE - INTERVAL '21 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('zema_contact_center', 'texting', 'performance_center', 'action_hub'))
FROM product_categories pc WHERE pc.name = 'voice_phone_system';

-- Green Guard Services - enterprise deal
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444010',
  '22222222-2222-2222-2222-222222222010',
  '11111111-1111-1111-1111-111111111004', -- Doug
  'Enterprise Package',
  'demo',
  'new_business',
  'voice_outside',
  75,
  85000,
  CURRENT_DATE + INTERVAL '60 days',
  CURRENT_DATE - INTERVAL '4 days',
  CURRENT_DATE - INTERVAL '30 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('zema_contact_center', 'texting', 'did_numbers', 'performance_center', 'action_hub', 'accountability_hub', 'receptionist_agent', 'dispatch_agent'))
FROM product_categories pc WHERE pc.name = 'voice_phone_system';

-- Critter Control Plus - early stage deal
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444011',
  '22222222-2222-2222-2222-222222222011',
  '11111111-1111-1111-1111-111111111002', -- Raymond
  'Voice + Platform',
  'qualifying',
  'new_business',
  'voice_outside',
  68,
  12000,
  CURRENT_DATE + INTERVAL '45 days',
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '12 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('basic_phone', 'texting', 'performance_center'))
FROM product_categories pc WHERE pc.name = 'voice_phone_system';

-- Nature's Defense Pest - new lead
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444012',
  '22222222-2222-2222-2222-222222222012',
  '11111111-1111-1111-1111-111111111003', -- Cabrin
  'Voice System',
  'new_lead',
  'new_business',
  'voice_outside',
  50,
  6000,
  NULL,
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE - INTERVAL '2 days',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'basic_phone')
FROM product_categories pc WHERE pc.name = 'voice_phone_system';

-- BugBusters Inc - upsell opportunity (new lead)
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444013',
  '22222222-2222-2222-2222-222222222005',
  '11111111-1111-1111-1111-111111111005', -- Kayla (inside sales)
  'Platform Upsell',
  'new_lead',
  'upsell',
  'voice_inside',
  50,
  7200,
  NULL,
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE - INTERVAL '1 day',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('texting', 'performance_center'))
FROM product_categories pc WHERE pc.name = 'xrai_platform';

-- CLOSED DEALS for history

-- ABC Pest - closed won X-RAI Platform
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, closed_at, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444014',
  '22222222-2222-2222-2222-222222222001',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'X-RAI Platform',
  'closed_won',
  'cross_sell',
  'xrai',
  95,
  18000,
  '2024-10-15',
  '2024-10-15',
  '2024-10-15',
  '2024-08-01',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('performance_center', 'action_hub'))
FROM product_categories pc WHERE pc.name = 'xrai_platform';

-- ABC Pest - closed won Voice System
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, closed_at, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444015',
  '22222222-2222-2222-2222-222222222001',
  '11111111-1111-1111-1111-111111111001', -- Michael
  'Voice System',
  'closed_won',
  'new_business',
  'voice_outside',
  92,
  8400,
  '2024-03-15',
  '2024-03-15',
  '2024-03-15',
  '2024-01-15',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('zema_contact_center', 'texting'))
FROM product_categories pc WHERE pc.name = 'voice_phone_system';

-- Premier Lawn - closed won Performance Center
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, closed_at, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444016',
  '22222222-2222-2222-2222-222222222004',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'Performance Center',
  'closed_won',
  'cross_sell',
  'xrai',
  88,
  10800,
  '2024-06-20',
  '2024-06-20',
  '2024-06-20',
  '2024-04-15',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'performance_center')
FROM product_categories pc WHERE pc.name = 'xrai_platform';

-- Premier Lawn - AI Agents declined (closed_lost)
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, closed_at, lost_reason, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444017',
  '22222222-2222-2222-2222-222222222004',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'AI Agents',
  'closed_lost',
  'cross_sell',
  'xrai',
  35,
  8400,
  '2024-03-30',
  '2024-03-30',
  'Wanted to wait until after busy season',
  '2024-03-30',
  '2024-02-15',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name = 'receptionist_agent')
FROM product_categories pc WHERE pc.name = 'xrai_ai_agents';

-- Apex Pest - closed lost (churned customer)
INSERT INTO deals (id, company_id, owner_id, name, stage, deal_type, sales_team, health_score, estimated_value, expected_close_date, closed_at, lost_reason, stage_entered_at, created_at,
  primary_product_category_id, quoted_products)
SELECT
  '44444444-4444-4444-4444-444444444018',
  '22222222-2222-2222-2222-222222222015',
  '11111111-1111-1111-1111-111111111001', -- Michael
  'Voice System Renewal',
  'closed_lost',
  'renewal',
  'voice_outside',
  20,
  7200,
  '2024-08-01',
  '2024-08-15',
  'Price - went with competitor',
  '2024-08-15',
  '2024-06-01',
  pc.id,
  (SELECT json_agg(p.id) FROM products p WHERE p.name IN ('basic_phone', 'texting'))
FROM product_categories pc WHERE pc.name = 'voice_phone_system';

-- ============================================
-- 6. COMPANY PRODUCTS
-- ============================================

-- ABC Pest Control products
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222001', id, 'active', '2024-03-15', 450 FROM products WHERE name = 'zema_contact_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222001', id, 'active', '2024-03-15', 150 FROM products WHERE name = 'texting';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222001', id, 'active', '2024-10-15', 1800 FROM products WHERE name = 'performance_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222001', id, 'active', '2024-10-15', 275 FROM products WHERE name = 'action_hub';

-- Sunshine Exterminators products
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222002', id, 'active', '2024-01-10', 600 FROM products WHERE name = 'basic_phone';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222002', id, 'active', '2024-01-10', 100 FROM products WHERE name = 'texting';

-- Gulf Coast Pest Services products (enterprise)
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222003', id, 'active', '2023-06-01', 4500 FROM products WHERE name = 'zema_contact_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222003', id, 'active', '2023-06-01', 400 FROM products WHERE name = 'texting';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222003', id, 'active', '2023-06-01', 200 FROM products WHERE name = 'did_numbers';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222003', id, 'active', '2023-09-01', 6750 FROM products WHERE name = 'performance_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222003', id, 'active', '2023-09-01', 1200 FROM products WHERE name = 'action_hub';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222003', id, 'active', '2024-01-15', 1200 FROM products WHERE name = 'accountability_hub';

-- Premier Lawn & Pest products
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222004', id, 'active', '2023-09-01', 1200 FROM products WHERE name = 'basic_phone';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222004', id, 'active', '2024-06-20', 2700 FROM products WHERE name = 'performance_center';

-- BugBusters Inc products
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222005', id, 'active', '2024-11-01', 500 FROM products WHERE name = 'basic_phone';

-- Court Pest Management products
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222006', id, 'active', '2024-02-15', 2200 FROM products WHERE name = 'zema_contact_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222006', id, 'active', '2024-05-01', 2250 FROM products WHERE name = 'performance_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222006', id, 'active', '2024-05-01', 500 FROM products WHERE name = 'action_hub';

-- Evergreen Lawn Care products (fully sold reference account)
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222007', id, 'active', '2023-04-01', 3800 FROM products WHERE name = 'zema_contact_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222007', id, 'active', '2023-04-01', 350 FROM products WHERE name = 'texting';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222007', id, 'active', '2023-04-01', 150 FROM products WHERE name = 'did_numbers';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222007', id, 'active', '2023-07-01', 5700 FROM products WHERE name = 'performance_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222007', id, 'active', '2023-07-01', 1000 FROM products WHERE name = 'action_hub';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222007', id, 'active', '2023-09-01', 1000 FROM products WHERE name = 'accountability_hub';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222007', id, 'active', '2024-02-01', 800 FROM products WHERE name = 'basic_routing_agent';

-- Excel Pest Solutions products
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222008', id, 'active', '2024-08-01', 2800 FROM products WHERE name = 'zema_contact_center';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222008', id, 'active', '2024-08-01', 250 FROM products WHERE name = 'texting';
INSERT INTO company_products (company_id, product_id, status, started_at, mrr)
SELECT '22222222-2222-2222-2222-222222222008', id, 'active', '2024-10-01', 3300 FROM products WHERE name = 'performance_center';

-- Apex Pest Solutions (churned products)
INSERT INTO company_products (company_id, product_id, status, started_at, ended_at, churn_reason, mrr)
SELECT '22222222-2222-2222-2222-222222222015', id, 'churned', '2023-01-15', '2024-08-15', 'Switched to competitor - price', 900 FROM products WHERE name = 'basic_phone';
INSERT INTO company_products (company_id, product_id, status, started_at, ended_at, churn_reason, mrr)
SELECT '22222222-2222-2222-2222-222222222015', id, 'churned', '2023-01-15', '2024-08-15', 'Switched to competitor - price', 120 FROM products WHERE name = 'texting';

-- ============================================
-- 7. COMPANY PRODUCT HISTORY
-- ============================================

-- ABC Pest Control history
INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, notes)
SELECT '22222222-2222-2222-2222-222222222001', id, 'purchased', '2024-03-15', '11111111-1111-1111-1111-111111111001', '44444444-4444-4444-4444-444444444015', 'Initial Voice sale'
FROM products WHERE name = 'zema_contact_center';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, notes)
SELECT '22222222-2222-2222-2222-222222222001', id, 'purchased', '2024-03-15', '11111111-1111-1111-1111-111111111001', '44444444-4444-4444-4444-444444444015', 'Bundled with Voice sale'
FROM products WHERE name = 'texting';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, notes)
SELECT '22222222-2222-2222-2222-222222222001', id, 'purchased', '2024-10-15', '11111111-1111-1111-1111-111111111008', '44444444-4444-4444-4444-444444444014', 'X-RAI Platform expansion'
FROM products WHERE name = 'performance_center';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, notes)
SELECT '22222222-2222-2222-2222-222222222001', id, 'purchased', '2024-10-15', '11111111-1111-1111-1111-111111111008', '44444444-4444-4444-4444-444444444014', 'Bundled with Performance Center'
FROM products WHERE name = 'action_hub';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, notes)
SELECT '22222222-2222-2222-2222-222222222001', id, 'pitched', '2024-11-20', '11111111-1111-1111-1111-111111111008', 'Customer interested, moved to trial'
FROM products WHERE name = 'receptionist_agent';

-- Premier Lawn history
INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, notes)
SELECT '22222222-2222-2222-2222-222222222004', id, 'purchased', '2023-09-01', '11111111-1111-1111-1111-111111111004', 'Initial Voice sale'
FROM products WHERE name = 'basic_phone';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, notes)
SELECT '22222222-2222-2222-2222-222222222004', id, 'purchased', '2024-06-20', '11111111-1111-1111-1111-111111111008', '44444444-4444-4444-4444-444444444016', 'Cross-sell from Voice'
FROM products WHERE name = 'performance_center';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, decline_reason)
SELECT '22222222-2222-2222-2222-222222222004', id, 'declined', '2024-03-30', '11111111-1111-1111-1111-111111111008', '44444444-4444-4444-4444-444444444017', 'Wanted to wait until after busy season'
FROM products WHERE name = 'receptionist_agent';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, notes)
SELECT '22222222-2222-2222-2222-222222222004', id, 'pitched', CURRENT_DATE - INTERVAL '20 days', '11111111-1111-1111-1111-111111111009', 'Reopening conversation, deal in discovery'
FROM products WHERE name = 'action_hub';

-- Apex Pest history (churned)
INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, notes)
SELECT '22222222-2222-2222-2222-222222222015', id, 'purchased', '2023-01-15', '11111111-1111-1111-1111-111111111001', 'Initial sale'
FROM products WHERE name = 'basic_phone';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, notes)
SELECT '22222222-2222-2222-2222-222222222015', id, 'purchased', '2023-01-15', '11111111-1111-1111-1111-111111111001', 'Bundled with phone'
FROM products WHERE name = 'texting';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, notes)
SELECT '22222222-2222-2222-2222-222222222015', id, 'churned', '2024-08-15', '11111111-1111-1111-1111-111111111001', '44444444-4444-4444-4444-444444444018', 'Lost to competitor on price'
FROM products WHERE name = 'basic_phone';

INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, deal_id, notes)
SELECT '22222222-2222-2222-2222-222222222015', id, 'churned', '2024-08-15', '11111111-1111-1111-1111-111111111001', '44444444-4444-4444-4444-444444444018', 'Churned with phone'
FROM products WHERE name = 'texting';

-- ============================================
-- 8. ACTIVITIES
-- ============================================

-- ABC Pest - AI Agent Receptionist deal activities
INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222001',
  '44444444-4444-4444-4444-444444444001',
  '33333333-3333-3333-3333-333333333001',
  '11111111-1111-1111-1111-111111111008',
  'email_sent',
  'Trial check-in day 3',
  'Hi John, just wanted to check in on how the receptionist agent is performing. Have you had a chance to review the call logs? Let me know if you have any questions.',
  CURRENT_TIMESTAMP - INTERVAL '2 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, summary, metadata, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222001',
  '44444444-4444-4444-4444-444444444001',
  '33333333-3333-3333-3333-333333333001',
  '11111111-1111-1111-1111-111111111008',
  'meeting',
  'Trial onboarding call',
  'Walked through the agent configuration and reporting dashboard.',
  'Trial onboarding completed. John and Sarah attended. Configured agent for after-hours and overflow scenarios. Customer excited about reducing missed calls. Next step: check metrics after first weekend.',
  '{"attendees": ["John Smith", "Sarah Johnson", "Brent Williams"], "duration_minutes": 45}',
  CURRENT_TIMESTAMP - INTERVAL '4 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222001',
  '44444444-4444-4444-4444-444444444001',
  '33333333-3333-3333-3333-333333333001',
  '11111111-1111-1111-1111-111111111008',
  'email_received',
  'Ready to start trial',
  'Brent, we are ready to start the trial. When can we do the onboarding call? - John',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, summary, metadata, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222001',
  '44444444-4444-4444-4444-444444444001',
  '33333333-3333-3333-3333-333333333001',
  '11111111-1111-1111-1111-111111111008',
  'meeting',
  'Demo call',
  'Demonstrated the AI receptionist capabilities and how it integrates with their existing Voice system.',
  'Demo went very well. John and Sarah were impressed with the natural conversation flow. Main use case: after-hours coverage and lunch breaks. Agreed to 14-day trial.',
  '{"attendees": ["John Smith", "Sarah Johnson", "Brent Williams"], "duration_minutes": 60}',
  CURRENT_TIMESTAMP - INTERVAL '8 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222001',
  '44444444-4444-4444-4444-444444444001',
  '33333333-3333-3333-3333-333333333001',
  '11111111-1111-1111-1111-111111111008',
  'email_sent',
  'Following up on AI agents',
  'Hi John, following up on our conversation at PestWorld. When would be a good time to show you the AI receptionist agent?',
  CURRENT_TIMESTAMP - INTERVAL '11 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222001',
  '44444444-4444-4444-4444-444444444001',
  '11111111-1111-1111-1111-111111111008',
  'note',
  'PestWorld follow-up',
  'Spoke with John Smith at PestWorld conference. Very interested in after-hours coverage - currently missing 15-20 calls per day after 5pm.',
  CURRENT_TIMESTAMP - INTERVAL '16 days',
  ARRAY['voice', 'xrai']
);

-- Excel Pest Solutions - conflict deal activities
INSERT INTO activities (company_id, deal_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222008',
  '44444444-4444-4444-4444-444444444008',
  '11111111-1111-1111-1111-111111111002',
  'note',
  'Questions about Excel Pest',
  'Internal note: Need to sync with Madi about this account. I had initial contact at a trade show but looks like she has the deal.',
  CURRENT_TIMESTAMP - INTERVAL '2 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222008',
  '44444444-4444-4444-4444-444444444008',
  '33333333-3333-3333-3333-333333333024',
  '11111111-1111-1111-1111-111111111002',
  'email_sent',
  'We can definitely get you set up',
  'Hi Daniel, great meeting you at the show! I can definitely get you set up with our AI agents. What does your timeline look like?',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  ARRAY['voice']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222008',
  '44444444-4444-4444-4444-444444444008',
  '33333333-3333-3333-3333-333333333024',
  '11111111-1111-1111-1111-111111111009',
  'email_sent',
  'No more December slots available',
  'Hi Daniel, just wanted to let you know we only have 2 onboarding slots left in December. Let me know if you want to lock one in.',
  CURRENT_TIMESTAMP - INTERVAL '6 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, summary, metadata, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222008',
  '44444444-4444-4444-4444-444444444008',
  '33333333-3333-3333-3333-333333333024',
  '11111111-1111-1111-1111-111111111009',
  'meeting',
  'AI Agent demo',
  'Demonstrated the after-hours agent capabilities.',
  'Demo completed. Daniel interested but wants to run it by his ops manager Rebecca. Concerns about integration with PestPac. Follow up next week.',
  '{"attendees": ["Daniel Wright", "Madi Chen"], "duration_minutes": 45}',
  CURRENT_TIMESTAMP - INTERVAL '9 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222008',
  '44444444-4444-4444-4444-444444444008',
  '33333333-3333-3333-3333-333333333024',
  '11111111-1111-1111-1111-111111111009',
  'email_sent',
  'Only 2 December onboarding slots left',
  'Hi Daniel, I wanted to reach out because our December calendar is filling up fast. We only have 2 slots left for AI agent onboarding this month.',
  CURRENT_TIMESTAMP - INTERVAL '13 days',
  ARRAY['voice', 'xrai']
);

-- Green Guard Services - enterprise deal activities
INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, summary, metadata, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222010',
  '44444444-4444-4444-4444-444444444010',
  '33333333-3333-3333-3333-333333333030',
  '11111111-1111-1111-1111-111111111004',
  'meeting',
  'Enterprise demo - Day 1',
  'Full platform demo with executive team.',
  'Excellent reception from Katherine and Thomas. Steven (CFO) asked tough questions about ROI - need to prepare detailed business case. Nicole excited about AI agents. Demo Day 2 scheduled for next week to cover implementation details.',
  '{"attendees": ["Katherine Shaw", "Thomas Reed", "Nicole Barnes", "Steven Morris", "Doug Patterson", "Brent Williams"], "duration_minutes": 90}',
  CURRENT_TIMESTAMP - INTERVAL '4 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222010',
  '44444444-4444-4444-4444-444444444010',
  '33333333-3333-3333-3333-333333333030',
  '11111111-1111-1111-1111-111111111004',
  'email_sent',
  'Demo follow-up materials',
  'Katherine, attached please find the ROI calculator and case studies we discussed. Looking forward to Demo Day 2 next week.',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, summary, metadata, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222010',
  '44444444-4444-4444-4444-444444444010',
  '33333333-3333-3333-3333-333333333030',
  '11111111-1111-1111-1111-111111111004',
  'meeting',
  'Discovery call',
  'Initial discovery with Green Guard executive team.',
  'PE-backed company with 8 locations across TN and KY. Currently using legacy phone system with no analytics. Pain points: missed calls, no visibility into rep performance, manual dispatch. Timeline: Q1 2025 implementation. Budget: approved for $80-100K annual.',
  '{"attendees": ["Katherine Shaw", "Thomas Reed", "Doug Patterson"], "duration_minutes": 60}',
  CURRENT_TIMESTAMP - INTERVAL '18 days',
  ARRAY['voice', 'xrai']
);

-- Gulf Coast - negotiation activities
INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222003',
  '44444444-4444-4444-4444-444444444004',
  '33333333-3333-3333-3333-333333333007',
  '11111111-1111-1111-1111-111111111008',
  'email_sent',
  'Revised proposal',
  'Robert, attached is the revised proposal with the multi-agent bundle pricing we discussed. This includes the receptionist, dispatch, outbound sales, and billing agents.',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, sentiment, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222003',
  '44444444-4444-4444-4444-444444444004',
  '33333333-3333-3333-3333-333333333007',
  '11111111-1111-1111-1111-111111111008',
  'call',
  'Pricing discussion',
  'Discussed pricing with Robert. He needs to get final approval from Tom (CFO) but said numbers look good.',
  'positive',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, summary, metadata, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222003',
  '44444444-4444-4444-4444-444444444004',
  '33333333-3333-3333-3333-333333333010',
  '11111111-1111-1111-1111-111111111008',
  'meeting',
  'AI Agents deep dive',
  'Technical deep dive on AI agent capabilities with Jennifer and David.',
  'Jennifer (champion) very enthusiastic. David had questions about API integration - confirmed we have PestPac connector. Walked through each agent type and customization options. Next step: final proposal to Robert and Tom.',
  '{"attendees": ["Jennifer Adams", "David Park", "Brent Williams"], "duration_minutes": 75}',
  CURRENT_TIMESTAMP - INTERVAL '12 days',
  ARRAY['voice', 'xrai']
);

-- Court Pest - trial activities
INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222006',
  '44444444-4444-4444-4444-444444444006',
  '33333333-3333-3333-3333-333333333019',
  '11111111-1111-1111-1111-111111111009',
  'email_sent',
  'Trial metrics - Week 1',
  'Mark, here are the metrics from the first week of the trial. The agent handled 127 calls with a 94% resolution rate. Let me know if you want to discuss.',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, sentiment, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222006',
  '44444444-4444-4444-4444-444444444006',
  '33333333-3333-3333-3333-333333333019',
  '11111111-1111-1111-1111-111111111009',
  'call',
  'Trial check-in',
  'Quick call with Mark. Trial going well - CSRs love having the backup during lunch. One minor issue with hold music to address.',
  'positive',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  ARRAY['voice', 'xrai']
);

-- Blue Beetle - winback activities
INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, summary, metadata, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222009',
  '44444444-4444-4444-4444-444444444009',
  '33333333-3333-3333-3333-333333333027',
  '11111111-1111-1111-1111-111111111001',
  'meeting',
  'Reconnection call',
  'Discussed what has changed since they left 2 years ago.',
  'Richard acknowledged they made a mistake leaving. Their current provider has poor support and no platform capabilities. Very interested in new Contact Center features and X-RAI platform. Wants full demo next week. Note: they had billing issues before - need to address upfront.',
  '{"attendees": ["Richard Lopez", "Angela Santos", "Michael Torres"], "duration_minutes": 45}',
  CURRENT_TIMESTAMP - INTERVAL '7 days',
  ARRAY['voice', 'xrai']
);

INSERT INTO activities (company_id, deal_id, contact_id, user_id, type, subject, body, occurred_at, visible_to_teams)
VALUES (
  '22222222-2222-2222-2222-222222222009',
  '44444444-4444-4444-4444-444444444009',
  '33333333-3333-3333-3333-333333333027',
  '11111111-1111-1111-1111-111111111001',
  'email_received',
  'Interested in coming back',
  'Michael, we have been having a lot of issues with our current provider. Can we talk about what Voice has to offer now? - Richard',
  CURRENT_TIMESTAMP - INTERVAL '14 days',
  ARRAY['voice', 'xrai']
);

-- ============================================
-- 9. DEAL COLLABORATORS
-- ============================================

-- Excel Pest deal - Madi is owner, Raymond should be collaborator (conflict scenario)
INSERT INTO deal_collaborators (deal_id, user_id, role, added_by)
VALUES (
  '44444444-4444-4444-4444-444444444008',
  '11111111-1111-1111-1111-111111111002', -- Raymond
  'collaborator',
  '11111111-1111-1111-1111-111111111009' -- Added by Madi
);

-- Gulf Coast deal - Brent is owner, Doug is collaborator (Voice relationship)
INSERT INTO deal_collaborators (deal_id, user_id, role, added_by)
VALUES (
  '44444444-4444-4444-4444-444444444004',
  '11111111-1111-1111-1111-111111111004', -- Doug
  'collaborator',
  '11111111-1111-1111-1111-111111111008' -- Added by Brent
);

-- Green Guard deal - Doug is owner, Brent is collaborator (X-RAI component)
INSERT INTO deal_collaborators (deal_id, user_id, role, added_by)
VALUES (
  '44444444-4444-4444-4444-444444444010',
  '11111111-1111-1111-1111-111111111008', -- Brent
  'collaborator',
  '11111111-1111-1111-1111-111111111004' -- Added by Doug
);

-- ABC Pest Platform deal - Brent owner, Michael informed (Voice originator)
INSERT INTO deal_collaborators (deal_id, user_id, role, added_by)
VALUES (
  '44444444-4444-4444-4444-444444444001',
  '11111111-1111-1111-1111-111111111001', -- Michael
  'informed',
  '11111111-1111-1111-1111-111111111008' -- Added by Brent
);

-- ============================================
-- 10. COMPANY WATCHERS
-- ============================================

-- Voice customers watched by their account managers
INSERT INTO company_watchers (company_id, user_id, reason) VALUES
  ('22222222-2222-2222-2222-222222222001', '11111111-1111-1111-1111-111111111001', 'Voice account manager'), -- ABC Pest - Michael
  ('22222222-2222-2222-2222-222222222002', '11111111-1111-1111-1111-111111111001', 'Voice account manager'), -- Sunshine - Michael
  ('22222222-2222-2222-2222-222222222003', '11111111-1111-1111-1111-111111111004', 'Voice account manager'), -- Gulf Coast - Doug
  ('22222222-2222-2222-2222-222222222004', '11111111-1111-1111-1111-111111111004', 'Voice account manager'), -- Premier Lawn - Doug
  ('22222222-2222-2222-2222-222222222005', '11111111-1111-1111-1111-111111111005', 'Voice account manager'), -- BugBusters - Kayla (inside)
  ('22222222-2222-2222-2222-222222222006', '11111111-1111-1111-1111-111111111001', 'Voice account manager'), -- Court Pest - Michael
  ('22222222-2222-2222-2222-222222222007', '11111111-1111-1111-1111-111111111004', 'Voice account manager'), -- Evergreen - Doug
  ('22222222-2222-2222-2222-222222222008', '11111111-1111-1111-1111-111111111002', 'Voice account manager') -- Excel Pest - Raymond
ON CONFLICT (company_id, user_id) DO NOTHING;

-- X-RAI team watches customers with platform products
INSERT INTO company_watchers (company_id, user_id, reason) VALUES
  ('22222222-2222-2222-2222-222222222001', '11111111-1111-1111-1111-111111111008', 'X-RAI Platform customer'), -- ABC Pest - Brent
  ('22222222-2222-2222-2222-222222222003', '11111111-1111-1111-1111-111111111008', 'X-RAI Platform customer'), -- Gulf Coast - Brent
  ('22222222-2222-2222-2222-222222222004', '11111111-1111-1111-1111-111111111009', 'X-RAI Platform customer'), -- Premier Lawn - Madi
  ('22222222-2222-2222-2222-222222222006', '11111111-1111-1111-1111-111111111009', 'X-RAI Platform customer'), -- Court Pest - Madi
  ('22222222-2222-2222-2222-222222222007', '11111111-1111-1111-1111-111111111008', 'X-RAI Platform customer'), -- Evergreen - Brent
  ('22222222-2222-2222-2222-222222222008', '11111111-1111-1111-1111-111111111009', 'X-RAI Platform customer') -- Excel Pest - Madi
ON CONFLICT (company_id, user_id) DO NOTHING;

-- ============================================
-- 11. COMPANY SIGNALS (AI-detected opportunities)
-- ============================================

-- BugBusters - voicemail spike (upsell opportunity)
INSERT INTO company_signals (company_id, signal_type, signal_data, detected_at, recommended_action, recommended_product_id, status, assigned_to)
SELECT
  '22222222-2222-2222-2222-222222222005',
  'voicemail_spike',
  '{"current_weekly_voicemails": 85, "average_weekly_voicemails": 20, "spike_percentage": 325, "peak_hours": ["17:00-18:00", "12:00-13:00"]}',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  'Pitch AI Agent for after-hours and lunch coverage',
  p.id,
  'new',
  NULL
FROM products p WHERE p.name = 'receptionist_agent';

-- Premier Lawn - queue time increase
INSERT INTO company_signals (company_id, signal_type, signal_data, detected_at, recommended_action, recommended_product_id, status, assigned_to)
SELECT
  '22222222-2222-2222-2222-222222222004',
  'queue_time_increase',
  '{"current_avg_queue_seconds": 300, "previous_avg_queue_seconds": 90, "increase_percentage": 233, "calls_abandoned": 12}',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  'Discuss capacity - may need AI Agent or additional staffing',
  p.id,
  'new',
  NULL
FROM products p WHERE p.name = 'receptionist_agent';

-- Evergreen Lawn - engagement drop (reference account at risk?)
INSERT INTO company_signals (company_id, signal_type, signal_data, detected_at, recommended_action, status, assigned_to, acted_on_at, acted_on_by)
VALUES (
  '22222222-2222-2222-2222-222222222007',
  'engagement_drop',
  '{"days_since_platform_login": 21, "previous_login_frequency": "daily", "dashboard_views_last_30_days": 2}',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  'Schedule re-engagement call - check if they need training refresh',
  'acted_on',
  '11111111-1111-1111-1111-111111111008', -- Assigned to Brent
  CURRENT_TIMESTAMP - INTERVAL '2 days',
  '11111111-1111-1111-1111-111111111008'
);

-- Sunshine Exterminators - expansion indicator
INSERT INTO company_signals (company_id, signal_type, signal_data, detected_at, recommended_action, recommended_product_id, status, assigned_to)
SELECT
  '22222222-2222-2222-2222-222222222002',
  'expansion_indicator',
  '{"new_dids_requested": 3, "agent_count_change": 2, "call_volume_increase_percent": 40}',
  CURRENT_TIMESTAMP - INTERVAL '7 days',
  'Growing company - good time for platform upsell',
  p.id,
  'new',
  NULL
FROM products p WHERE p.name = 'performance_center';

-- Gulf Coast - DID request
INSERT INTO company_signals (company_id, signal_type, signal_data, detected_at, recommended_action, status, assigned_to)
VALUES (
  '22222222-2222-2222-2222-222222222003',
  'did_request',
  '{"dids_requested": 5, "current_dids": 12, "reason": "New Houston location opening"}',
  CURRENT_TIMESTAMP - INTERVAL '2 days',
  'Opportunity to expand AI agents to new location',
  'new',
  '11111111-1111-1111-1111-111111111008'
);

-- ============================================
-- 12. TASKS
-- ============================================

-- High priority tasks
INSERT INTO tasks (deal_id, company_id, assigned_to, type, title, description, priority, due_at, source)
VALUES (
  '44444444-4444-4444-4444-444444444001',
  '22222222-2222-2222-2222-222222222001',
  '11111111-1111-1111-1111-111111111008',
  'follow_up',
  'Check ABC Pest trial metrics',
  'Review call handling metrics from first week of receptionist agent trial',
  'high',
  CURRENT_TIMESTAMP + INTERVAL '1 day',
  'ai_recommendation'
);

INSERT INTO tasks (deal_id, company_id, assigned_to, type, title, description, priority, due_at, source)
VALUES (
  '44444444-4444-4444-4444-444444444004',
  '22222222-2222-2222-2222-222222222003',
  '11111111-1111-1111-1111-111111111008',
  'call',
  'Follow up on Gulf Coast proposal',
  'Call Robert to check on CFO approval status for AI Agents bundle',
  'high',
  CURRENT_TIMESTAMP + INTERVAL '2 days',
  'manual'
);

INSERT INTO tasks (deal_id, company_id, assigned_to, type, title, description, priority, due_at, source)
VALUES (
  '44444444-4444-4444-4444-444444444010',
  '22222222-2222-2222-2222-222222222010',
  '11111111-1111-1111-1111-111111111004',
  'meeting',
  'Green Guard Demo Day 2',
  'Implementation details demo with IT team',
  'high',
  CURRENT_TIMESTAMP + INTERVAL '3 days',
  'meeting_extraction'
);

-- Medium priority tasks
INSERT INTO tasks (deal_id, company_id, assigned_to, type, title, description, priority, due_at, source)
VALUES (
  '44444444-4444-4444-4444-444444444003',
  '22222222-2222-2222-2222-222222222002',
  '11111111-1111-1111-1111-111111111008',
  'email',
  'Send Sunshine proposal',
  'Create and send X-RAI Platform proposal after demo feedback',
  'medium',
  CURRENT_TIMESTAMP + INTERVAL '2 days',
  'manual'
);

INSERT INTO tasks (deal_id, company_id, assigned_to, type, title, description, priority, due_at, source)
VALUES (
  '44444444-4444-4444-4444-444444444005',
  '22222222-2222-2222-2222-222222222004',
  '11111111-1111-1111-1111-111111111009',
  'call',
  'Premier Lawn discovery follow-up',
  'Check if James had chance to review Action Hub info',
  'medium',
  CURRENT_TIMESTAMP + INTERVAL '4 days',
  'ai_recommendation'
);

INSERT INTO tasks (company_id, assigned_to, type, title, description, priority, due_at, source)
VALUES (
  '22222222-2222-2222-2222-222222222005',
  '11111111-1111-1111-1111-111111111005',
  'call',
  'BugBusters upsell call',
  'Call Tony about voicemail spike - good opportunity for platform pitch',
  'medium',
  CURRENT_TIMESTAMP + INTERVAL '1 day',
  'ai_recommendation'
);

-- Completed tasks
INSERT INTO tasks (deal_id, company_id, assigned_to, type, title, description, priority, due_at, completed_at, source)
VALUES (
  '44444444-4444-4444-4444-444444444006',
  '22222222-2222-2222-2222-222222222006',
  '11111111-1111-1111-1111-111111111009',
  'meeting',
  'Court Pest trial kickoff',
  'Trial onboarding call',
  'high',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  'manual'
);

INSERT INTO tasks (deal_id, company_id, assigned_to, type, title, description, priority, due_at, completed_at, source)
VALUES (
  '44444444-4444-4444-4444-444444444001',
  '22222222-2222-2222-2222-222222222001',
  '11111111-1111-1111-1111-111111111008',
  'meeting',
  'ABC Pest trial onboarding',
  'Agent configuration and training',
  'high',
  CURRENT_TIMESTAMP - INTERVAL '4 days',
  CURRENT_TIMESTAMP - INTERVAL '4 days',
  'manual'
);

-- ============================================
-- 13. UPDATE CONTACT LAST_CONTACTED_AT
-- ============================================

UPDATE contacts c
SET last_contacted_at = (
  SELECT MAX(occurred_at)
  FROM activities a
  WHERE a.contact_id = c.id
)
WHERE EXISTS (
  SELECT 1 FROM activities a WHERE a.contact_id = c.id
);

-- ============================================
-- VERIFY DATA
-- ============================================

-- This will show counts after seed
DO $$
DECLARE
  user_count INT;
  company_count INT;
  contact_count INT;
  deal_count INT;
  activity_count INT;
  product_count INT;
  signal_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO company_count FROM companies;
  SELECT COUNT(*) INTO contact_count FROM contacts;
  SELECT COUNT(*) INTO deal_count FROM deals;
  SELECT COUNT(*) INTO activity_count FROM activities;
  SELECT COUNT(*) INTO product_count FROM company_products;
  SELECT COUNT(*) INTO signal_count FROM company_signals;

  RAISE NOTICE 'Seed data complete:';
  RAISE NOTICE '  Users: %', user_count;
  RAISE NOTICE '  Companies: %', company_count;
  RAISE NOTICE '  Contacts: %', contact_count;
  RAISE NOTICE '  Deals: %', deal_count;
  RAISE NOTICE '  Activities: %', activity_count;
  RAISE NOTICE '  Company Products: %', product_count;
  RAISE NOTICE '  Signals: %', signal_count;
END $$;
