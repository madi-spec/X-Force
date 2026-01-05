-- Add title and phone columns to users table for profile settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
