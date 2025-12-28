-- Add ATS ID column to companies table
-- ATS ID is from the billing/X-RAI system, separate from Rev ID (vfp_customer_id)

-- Add the ats_id column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ats_id TEXT;

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_companies_ats_id ON companies(ats_id);

-- Add comment for documentation
COMMENT ON COLUMN companies.ats_id IS 'ATS system ID from billing spreadsheets (X-RAI, Summary Note, etc.)';
COMMENT ON COLUMN companies.vfp_customer_id IS 'Rev ID from KEEP spreadsheet (Revenue system)';
