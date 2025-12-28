-- Fix deal_stale items incorrectly assigned to Tier 5
-- These should be Tier 4 (MOVE BIG DEALS)

UPDATE command_center_items
SET tier = 4
WHERE tier_trigger = 'deal_stale'
  AND tier = 5;

-- Also update any going_stale items that should be Tier 2
UPDATE command_center_items
SET tier = 2
WHERE tier_trigger = 'going_stale'
  AND tier = 5;

-- Verify the fix
DO $$
DECLARE
  deal_stale_count INTEGER;
  going_stale_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deal_stale_count
  FROM command_center_items
  WHERE tier_trigger = 'deal_stale' AND tier = 5;

  SELECT COUNT(*) INTO going_stale_count
  FROM command_center_items
  WHERE tier_trigger = 'going_stale' AND tier = 5;

  IF deal_stale_count > 0 OR going_stale_count > 0 THEN
    RAISE WARNING 'Still have % deal_stale and % going_stale items at Tier 5',
      deal_stale_count, going_stale_count;
  END IF;
END $$;
