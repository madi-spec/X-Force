-- Backfill source_id on existing command_center_items
-- This fixes the "View Source" functionality

-- 1. Backfill email items (match by conversation_id → email_messages)
UPDATE command_center_items cci
SET source_id = em.id,
    email_id = em.id
FROM email_messages em
WHERE cci.source IN ('email_inbound', 'email_sync', 'email_ai_analysis')
  AND cci.source_id IS NULL
  AND cci.conversation_id IS NOT NULL
  AND em.conversation_ref = cci.conversation_id
  AND em.is_sent_by_user = false;

-- 2. Backfill transcript items (match by meeting_id → meeting_transcriptions)
UPDATE command_center_items cci
SET source_id = mt.id
FROM meeting_transcriptions mt
WHERE cci.source = 'transcription'
  AND cci.source_id IS NULL
  AND cci.meeting_id IS NOT NULL
  AND mt.id = cci.meeting_id;

-- 3. Backfill system items (deal-based) - use deal_id as source_id
UPDATE command_center_items
SET source_id = deal_id
WHERE source = 'system'
  AND source_id IS NULL
  AND deal_id IS NOT NULL;

-- 4. Backfill ai_recommendation items - use email_id if available
UPDATE command_center_items
SET source_id = email_id
WHERE source = 'ai_recommendation'
  AND source_id IS NULL
  AND email_id IS NOT NULL;

-- 5. For ai_recommendation without email_id, use conversation_id lookup
UPDATE command_center_items cci
SET source_id = em.id,
    email_id = em.id
FROM email_messages em
WHERE cci.source = 'ai_recommendation'
  AND cci.source_id IS NULL
  AND cci.conversation_id IS NOT NULL
  AND em.conversation_ref = cci.conversation_id
  AND em.is_sent_by_user = false;

-- Verify results
DO $$
DECLARE
  total_items INTEGER;
  items_with_source_id INTEGER;
  fill_rate NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_items
  FROM command_center_items
  WHERE status IN ('pending', 'in_progress');

  SELECT COUNT(*) INTO items_with_source_id
  FROM command_center_items
  WHERE status IN ('pending', 'in_progress')
    AND source_id IS NOT NULL;

  fill_rate := ROUND((items_with_source_id::NUMERIC / NULLIF(total_items, 0)) * 100, 1);

  RAISE NOTICE 'Backfill complete: % of % items now have source_id (%.1f%%)',
    items_with_source_id, total_items, fill_rate;
END $$;
