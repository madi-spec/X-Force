-- Comprehensive fix for user ID mismatch
-- The problem: RLS policies check auth.uid() = user_id
-- But command_center_items.user_id = '11111111-1111-1111-1111-111111111009' (seeded)
-- While auth.uid() returns '51c8f003-710b-4071-b3a4-d9cd141b1296' (actual auth user)

-- Solution: Update user_id in tables that have RLS policies to use the auth user ID

DO $$
DECLARE
  old_user_id UUID := '11111111-1111-1111-1111-111111111009';
  auth_user_id UUID := '51c8f003-710b-4071-b3a4-d9cd141b1296';
  updated_count INT;
BEGIN
  -- First, ensure the auth user exists in users table
  -- The users table has auth_id column that should match

  -- Check if auth_user_id already exists as a user
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth_user_id) THEN
    -- Copy the old user's data to new user with auth_user_id
    INSERT INTO users (id, email, name, role, team, auth_id, created_at)
    SELECT auth_user_id, email, name, role, team, auth_user_id, NOW()
    FROM users WHERE id = old_user_id
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created new user record with auth_user_id';
  ELSE
    RAISE NOTICE 'Auth user already exists in users table';
  END IF;

  -- Update command_center_items (main table for work queues)
  UPDATE command_center_items SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % command_center_items', updated_count;

  -- Update command_center_settings
  UPDATE command_center_settings SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % command_center_settings', updated_count;

  -- Update command_center_preferences
  UPDATE command_center_preferences SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % command_center_preferences', updated_count;

  -- Update ai_recommendations
  UPDATE ai_recommendations SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % ai_recommendations', updated_count;

  -- Update ai_alerts
  UPDATE ai_alerts SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % ai_alerts', updated_count;

  -- Update ai_draft_emails
  UPDATE ai_draft_emails SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % ai_draft_emails', updated_count;

  -- Update user_ai_context
  UPDATE user_ai_context SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % user_ai_context', updated_count;

  -- Update meeting_transcriptions
  UPDATE meeting_transcriptions SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % meeting_transcriptions', updated_count;

  -- Update microsoft_connections
  UPDATE microsoft_connections SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % microsoft_connections', updated_count;

  -- Update fireflies_connections
  UPDATE fireflies_connections SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % fireflies_connections', updated_count;

  -- Update scheduler_settings
  UPDATE scheduler_settings SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % scheduler_settings', updated_count;

  -- Update scheduler_requests
  UPDATE scheduler_requests SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % scheduler_requests', updated_count;

  -- Update email_threads
  UPDATE email_threads SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % email_threads', updated_count;

  -- Update email_messages
  UPDATE email_messages SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % email_messages', updated_count;

  -- Update email_drafts
  UPDATE email_drafts SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % email_drafts', updated_count;

  -- Update email_sync_status
  UPDATE email_sync_status SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % email_sync_status', updated_count;

  -- Update email_rules
  UPDATE email_rules SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % email_rules', updated_count;

  -- Update engagement_webhooks
  UPDATE engagement_webhooks SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % engagement_webhooks', updated_count;

  -- Update calendar_sync
  UPDATE calendar_sync SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % calendar_sync', updated_count;

  -- Update synced_calendar_events
  UPDATE synced_calendar_events SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % synced_calendar_events', updated_count;

  -- Update tasks assigned_to
  UPDATE tasks SET assigned_to = auth_user_id WHERE assigned_to = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % tasks (assigned_to)', updated_count;

  -- Update communications user_id
  UPDATE communications SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % communications', updated_count;

  -- Update activities user_id
  UPDATE activities SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % activities', updated_count;

  -- Update initial_historical_syncs
  UPDATE initial_historical_syncs SET user_id = auth_user_id WHERE user_id = old_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % initial_historical_syncs', updated_count;

  RAISE NOTICE '';
  RAISE NOTICE '✅ All user_id fields updated to auth_user_id';
  RAISE NOTICE 'The users table now has TWO user records:';
  RAISE NOTICE '  - Old seeded ID: %', old_user_id;
  RAISE NOTICE '  - Auth user ID: %', auth_user_id;
  RAISE NOTICE 'RLS policies using auth.uid() will now match correctly.';
END $$;

-- Verify the fix
SELECT
  'command_center_items' as table_name,
  user_id,
  COUNT(*) as count
FROM command_center_items
WHERE status = 'pending'
GROUP BY user_id
ORDER BY count DESC;
