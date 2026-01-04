-- Process-Aware AI Migration
-- Adds default_process_type column to users table for AI context awareness

-- Add default_process_type to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS default_process_type TEXT
DEFAULT 'sales'
CHECK (default_process_type IN ('sales', 'onboarding', 'engagement', 'support'));

COMMENT ON COLUMN users.default_process_type IS
'Default process context for AI features. Onboarding specialists set to onboarding, etc.';

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_users_default_process_type ON users(default_process_type);
