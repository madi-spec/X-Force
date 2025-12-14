-- Check and fix deals owner_id

-- First, let's see what we have
DO $$
DECLARE
  user_id UUID;
  deal_count INT;
BEGIN
  -- Get the test user's ID
  SELECT id INTO user_id FROM users WHERE email = 'test@xrai.com';

  IF user_id IS NULL THEN
    RAISE NOTICE 'Test user not found!';
  ELSE
    RAISE NOTICE 'Test user ID: %', user_id;
  END IF;

  -- Count deals
  SELECT COUNT(*) INTO deal_count FROM deals;
  RAISE NOTICE 'Total deals: %', deal_count;
END $$;

-- Update any deals that might have wrong owner_id
UPDATE deals
SET owner_id = (SELECT id FROM users WHERE email = 'test@xrai.com')
WHERE owner_id IS NULL OR owner_id NOT IN (SELECT id FROM users);

-- If no deals exist, recreate them
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
AND NOT EXISTS (SELECT 1 FROM deals WHERE name = 'Acme Pest - Voice + Platform');

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
AND NOT EXISTS (SELECT 1 FROM deals WHERE name = 'Green Lawn - Voice Only');

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
AND NOT EXISTS (SELECT 1 FROM deals WHERE name = 'Bug Busters - Enterprise Expansion');

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
AND NOT EXISTS (SELECT 1 FROM deals WHERE name = 'Total Turf - Full Suite Trial');
