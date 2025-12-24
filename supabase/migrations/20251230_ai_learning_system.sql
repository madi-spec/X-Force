-- Phase 5: AI Learning System
-- Add AI suggestion columns and transcript analysis fields

-- Add AI suggestion columns to product_sales_stages
ALTER TABLE product_sales_stages
ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add analysis tracking columns to transcripts
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES product_sales_stages(id),
ADD COLUMN IF NOT EXISTS sales_insights JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS extracted_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS extracted_pitch_points JSONB DEFAULT '[]';

-- Create index for faster transcript queries by product
CREATE INDEX IF NOT EXISTS idx_transcripts_product_id ON transcripts(product_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_stage_id ON transcripts(stage_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_sales_insights ON transcripts(sales_insights) WHERE sales_insights IS NOT NULL;

-- Add comment
COMMENT ON COLUMN product_sales_stages.ai_suggested_pitch_points IS 'AI-generated pitch point suggestions from transcript analysis';
COMMENT ON COLUMN product_sales_stages.ai_suggested_objections IS 'AI-detected common objections and successful responses';
COMMENT ON COLUMN product_sales_stages.ai_insights IS 'AI analysis metadata including win/loss patterns';
COMMENT ON COLUMN transcripts.sales_insights IS 'AI analysis results for this transcript';
COMMENT ON COLUMN transcripts.extracted_objections IS 'Objections extracted from this transcript';
COMMENT ON COLUMN transcripts.extracted_pitch_points IS 'Pitch points identified in this transcript';
