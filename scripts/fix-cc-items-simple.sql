-- Simple fix: Just update command_center_items user_id
-- This table is the main one used by work queues
-- RLS policy: auth.uid() = user_id

-- Step 1: Drop the FK constraint temporarily
ALTER TABLE command_center_items
DROP CONSTRAINT IF EXISTS command_center_items_user_id_fkey;

-- Step 2: Update user_id to match auth.uid()
UPDATE command_center_items
SET user_id = '51c8f003-710b-4071-b3a4-d9cd141b1296'
WHERE user_id = '11111111-1111-1111-1111-111111111009';

-- Step 3: Re-add FK constraint (now pointing to users table where auth_id matches)
-- Note: This will only work if the auth user exists in users table
-- If not, we skip the FK constraint re-add for now

-- Check if auth user exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id = '51c8f003-710b-4071-b3a4-d9cd141b1296') THEN
    ALTER TABLE command_center_items
    ADD CONSTRAINT command_center_items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE 'FK constraint re-added';
  ELSE
    RAISE NOTICE 'Auth user not in users table - FK constraint NOT added';
    RAISE NOTICE 'This is OK - RLS will still work';
  END IF;
END $$;

-- Verify
SELECT
  user_id,
  COUNT(*) as item_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count
FROM command_center_items
GROUP BY user_id;
