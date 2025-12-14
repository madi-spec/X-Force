-- Fix RLS for deal_stage_history table
-- The trigger runs as the user, so we need to allow inserts

-- Drop the existing select-only policy approach and allow inserts from authenticated users
CREATE POLICY deal_stage_history_insert ON deal_stage_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Also, the trigger should record who made the change
-- Update the trigger to include the user who made the change
CREATE OR REPLACE FUNCTION track_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, (SELECT id FROM users WHERE auth_id = auth.uid()));
    NEW.stage_entered_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
