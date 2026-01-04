-- Migration: Add company_product_id to tables with deal_id
-- This enables the deal → product transition while maintaining backwards compatibility

-- ============================================
-- 1. Activities table
-- ============================================
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_company_product_id ON activities(company_product_id);

COMMENT ON COLUMN activities.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 2. Tasks table
-- ============================================
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_company_product_id ON tasks(company_product_id);

COMMENT ON COLUMN tasks.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 3. Meeting transcriptions table
-- ============================================
ALTER TABLE meeting_transcriptions
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_company_product_id ON meeting_transcriptions(company_product_id);

COMMENT ON COLUMN meeting_transcriptions.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 4. Scheduling requests table
-- ============================================
ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_requests_company_product_id ON scheduling_requests(company_product_id);

COMMENT ON COLUMN scheduling_requests.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 5. Command center items table
-- ============================================
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_command_center_items_company_product_id ON command_center_items(company_product_id);

COMMENT ON COLUMN command_center_items.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 6. AI email drafts table (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_email_drafts' AND table_schema = 'public') THEN
    ALTER TABLE ai_email_drafts
    ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_ai_email_drafts_company_product_id ON ai_email_drafts(company_product_id);
  END IF;
END $$;

-- ============================================
-- 7. AI signals table (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_signals' AND table_schema = 'public') THEN
    ALTER TABLE ai_signals
    ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_ai_signals_company_product_id ON ai_signals(company_product_id);
  END IF;
END $$;

-- ============================================
-- 8. Communications table (add for consistency)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communications' AND table_schema = 'public') THEN
    ALTER TABLE communications
    ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_communications_company_product_id ON communications(company_product_id);
  END IF;
END $$;
