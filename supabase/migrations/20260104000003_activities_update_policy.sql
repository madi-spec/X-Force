-- Add UPDATE policy for activities table
-- This allows users to update their own activities (for exclusion, company assignment, etc.)

CREATE POLICY activities_update ON activities
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Add a comment explaining the policy
COMMENT ON POLICY activities_update ON activities IS
  'Users can update their own activities for features like exclusion and company assignment';
