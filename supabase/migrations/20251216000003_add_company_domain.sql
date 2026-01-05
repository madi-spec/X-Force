-- Add domain field to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS domain TEXT;

-- Create index for domain lookups
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
