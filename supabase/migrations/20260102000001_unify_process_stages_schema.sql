-- ============================================================================
-- PHASE 1.1: Extend product_process_stages with Gen 2 fields
-- ============================================================================
-- This migration adds sales enablement fields from product_sales_stages
-- to the unified product_process_stages table.
--
-- NO DATA IS MIGRATED HERE - just schema changes.
-- NO BREAKING CHANGES - existing queries continue to work.
--
-- Related Tables:
-- - product_sales_stages (Gen 2): Has pitch_points, objection_handlers, etc.
-- - product_process_stages (Gen 3): Base table we're extending
--
-- After this migration, product_process_stages can store ALL the content
-- that was previously only in product_sales_stages.
-- ============================================================================

-- Add goal field (exists in Gen 2, not in Gen 3)
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS goal TEXT;

-- Add sales enablement content fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS objection_handlers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]';

-- Add AI suggestion fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add metrics fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS avg_days_in_stage NUMERIC,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC;

-- Add automation fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS ai_sequence_id UUID,
ADD COLUMN IF NOT EXISTS ai_actions JSONB DEFAULT '[]';

-- Add exit actions field (exit_criteria already exists as JSONB in Gen 3)
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS exit_actions JSONB;

-- Add index for AI sequence lookup
CREATE INDEX IF NOT EXISTS idx_product_process_stages_ai_sequence
ON product_process_stages(ai_sequence_id)
WHERE ai_sequence_id IS NOT NULL;

-- Document the columns
COMMENT ON COLUMN product_process_stages.goal IS 'Stage goal text from Gen 2 ProvenProcess';
COMMENT ON COLUMN product_process_stages.pitch_points IS 'Array of pitch points: [{id, text, source, effectiveness_score}]';
COMMENT ON COLUMN product_process_stages.objection_handlers IS 'Array of objection handlers: [{id, objection, response, source}]';
COMMENT ON COLUMN product_process_stages.resources IS 'Array of resources: [{id, title, url, type}]';
COMMENT ON COLUMN product_process_stages.ai_suggested_pitch_points IS 'AI-generated pitch point suggestions from transcript analysis';
COMMENT ON COLUMN product_process_stages.ai_suggested_objections IS 'AI-generated objection handling suggestions';
COMMENT ON COLUMN product_process_stages.ai_insights IS 'AI analysis insights: {last_analyzed, transcript_count, patterns}';
COMMENT ON COLUMN product_process_stages.avg_days_in_stage IS 'Average days companies spend in this stage';
COMMENT ON COLUMN product_process_stages.conversion_rate IS 'Percentage of companies that advance from this stage';
COMMENT ON COLUMN product_process_stages.ai_sequence_id IS 'FK to AI sequence for automated actions';
COMMENT ON COLUMN product_process_stages.ai_actions IS 'Array of AI actions: [{type, config, trigger}]';
COMMENT ON COLUMN product_process_stages.exit_actions IS 'Actions to execute on stage exit';

-- ============================================================================
-- VERIFICATION QUERY (run manually to confirm migration success)
-- ============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'product_process_stages'
-- ORDER BY ordinal_position;
-- ============================================================================
