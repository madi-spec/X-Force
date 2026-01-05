-- Add default_lens column to users table
-- Allows users to set their preferred default lens for the work view

-- Create lens type enum
CREATE TYPE focus_lens AS ENUM ('focus', 'customer_success', 'sales', 'onboarding', 'support');

-- Add column with default value
ALTER TABLE users
ADD COLUMN IF NOT EXISTS default_lens focus_lens DEFAULT 'sales';

-- Add comment
COMMENT ON COLUMN users.default_lens IS 'User preferred default focus lens for work queue';
