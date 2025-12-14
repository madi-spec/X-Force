-- X-FORCE Sales Platform - Test Seed Data
-- Migration: 00003_seed_test_data

-- Create a test user
INSERT INTO users (email, name, role, level, team, hire_date)
VALUES ('test@xrai.com', 'Test User', 'admin', 'l3_senior', 'xrai', '2024-01-01')
ON CONFLICT (email) DO NOTHING;

-- Create sample organizations
INSERT INTO organizations (name, type, segment, industry, agent_count, crm_platform, address) VALUES
  ('Acme Pest Control', 'prospect', 'mid_market', 'pest', 12, 'fieldroutes', '{"street": "123 Main St", "city": "Tampa", "state": "FL", "zip": "33601"}'),
  ('Green Lawn Services', 'prospect', 'smb', 'lawn', 3, 'realgreen', '{"street": "456 Oak Ave", "city": "Orlando", "state": "FL", "zip": "32801"}'),
  ('Bug Busters Inc', 'customer', 'enterprise', 'pest', 45, 'pestpac', '{"street": "789 Corporate Blvd", "city": "Miami", "state": "FL", "zip": "33101"}'),
  ('Total Turf Management', 'prospect', 'mid_market', 'both', 18, 'fieldroutes', '{"street": "321 Park Lane", "city": "Jacksonville", "state": "FL", "zip": "32099"}')
ON CONFLICT DO NOTHING;

-- Create sample contacts
INSERT INTO contacts (organization_id, name, email, phone, title, role, is_primary)
SELECT
  o.id,
  'John Smith',
  'john@acmepest.com',
  '555-0101',
  'Owner',
  'decision_maker',
  true
FROM organizations o WHERE o.name = 'Acme Pest Control'
ON CONFLICT DO NOTHING;

INSERT INTO contacts (organization_id, name, email, phone, title, role, is_primary)
SELECT
  o.id,
  'Sarah Johnson',
  'sarah@greenlawn.com',
  '555-0102',
  'General Manager',
  'decision_maker',
  true
FROM organizations o WHERE o.name = 'Green Lawn Services'
ON CONFLICT DO NOTHING;

INSERT INTO contacts (organization_id, name, email, phone, title, role, is_primary)
SELECT
  o.id,
  'Mike Williams',
  'mike@bugbusters.com',
  '555-0103',
  'VP Operations',
  'decision_maker',
  true
FROM organizations o WHERE o.name = 'Bug Busters Inc'
ON CONFLICT DO NOTHING;

-- Create sample deals
INSERT INTO deals (organization_id, owner_id, name, stage, health_score, estimated_value, expected_close_date, products)
SELECT
  o.id,
  u.id,
  'Acme Pest - Voice + Platform',
  'discovery',
  75,
  35000,
  CURRENT_DATE + INTERVAL '30 days',
  '{"voice": true, "platform": true, "ai_agents": []}'
FROM organizations o, users u
WHERE o.name = 'Acme Pest Control' AND u.email = 'test@xrai.com'
ON CONFLICT DO NOTHING;

INSERT INTO deals (organization_id, owner_id, name, stage, health_score, estimated_value, expected_close_date, products)
SELECT
  o.id,
  u.id,
  'Green Lawn - Voice Only',
  'qualifying',
  60,
  8000,
  CURRENT_DATE + INTERVAL '14 days',
  '{"voice": true, "platform": false, "ai_agents": []}'
FROM organizations o, users u
WHERE o.name = 'Green Lawn Services' AND u.email = 'test@xrai.com'
ON CONFLICT DO NOTHING;

INSERT INTO deals (organization_id, owner_id, name, stage, health_score, estimated_value, expected_close_date, products)
SELECT
  o.id,
  u.id,
  'Bug Busters - Enterprise Expansion',
  'demo',
  85,
  120000,
  CURRENT_DATE + INTERVAL '45 days',
  '{"voice": true, "platform": true, "ai_agents": ["scheduling", "routing"]}'
FROM organizations o, users u
WHERE o.name = 'Bug Busters Inc' AND u.email = 'test@xrai.com'
ON CONFLICT DO NOTHING;

INSERT INTO deals (organization_id, owner_id, name, stage, health_score, estimated_value, expected_close_date, products)
SELECT
  o.id,
  u.id,
  'Total Turf - Full Suite Trial',
  'trial',
  45,
  42000,
  CURRENT_DATE + INTERVAL '7 days',
  '{"voice": true, "platform": true, "ai_agents": ["scheduling"]}'
FROM organizations o, users u
WHERE o.name = 'Total Turf Management' AND u.email = 'test@xrai.com'
ON CONFLICT DO NOTHING;

-- Create sample tasks
INSERT INTO tasks (deal_id, assigned_to, type, title, description, priority, due_at, source)
SELECT
  d.id,
  u.id,
  'follow_up',
  'Follow up on demo feedback',
  'Call John to discuss their thoughts on the demo from last week',
  'high',
  NOW() + INTERVAL '1 day',
  'ai_recommendation'
FROM deals d, users u
WHERE d.name = 'Acme Pest - Voice + Platform' AND u.email = 'test@xrai.com'
ON CONFLICT DO NOTHING;

INSERT INTO tasks (deal_id, assigned_to, type, title, description, priority, due_at, source)
SELECT
  d.id,
  u.id,
  'call',
  'Discovery call with Sarah',
  'Initial discovery call to understand pain points',
  'medium',
  NOW() + INTERVAL '2 days',
  'manual'
FROM deals d, users u
WHERE d.name = 'Green Lawn - Voice Only' AND u.email = 'test@xrai.com'
ON CONFLICT DO NOTHING;

INSERT INTO tasks (deal_id, assigned_to, type, title, description, priority, due_at, source)
SELECT
  d.id,
  u.id,
  'review',
  'Check trial engagement metrics',
  'Review login frequency and feature adoption for Total Turf trial',
  'high',
  NOW(),
  'ai_recommendation'
FROM deals d, users u
WHERE d.name = 'Total Turf - Full Suite Trial' AND u.email = 'test@xrai.com'
ON CONFLICT DO NOTHING;
