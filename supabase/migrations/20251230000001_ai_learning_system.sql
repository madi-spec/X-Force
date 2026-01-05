-- Phase 5: AI Learning System
-- Add AI suggestion columns and transcript analysis fields

-- Add AI suggestion columns to product_sales_stages
ALTER TABLE product_sales_stages
ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add analysis tracking columns to meeting_transcriptions
ALTER TABLE meeting_transcriptions
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES product_sales_stages(id),
ADD COLUMN IF NOT EXISTS sales_insights JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS extracted_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS extracted_pitch_points JSONB DEFAULT '[]';

-- Create index for faster transcript queries by product
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_product_id ON meeting_transcriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_stage_id ON meeting_transcriptions(stage_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_sales_insights ON meeting_transcriptions(sales_insights) WHERE sales_insights IS NOT NULL;

-- Add comment
COMMENT ON COLUMN product_sales_stages.ai_suggested_pitch_points IS 'AI-generated pitch point suggestions from transcript analysis';
COMMENT ON COLUMN product_sales_stages.ai_suggested_objections IS 'AI-detected common objections and successful responses';
COMMENT ON COLUMN product_sales_stages.ai_insights IS 'AI analysis metadata including win/loss patterns';
COMMENT ON COLUMN meeting_transcriptions.sales_insights IS 'AI analysis results for this transcript';
COMMENT ON COLUMN meeting_transcriptions.extracted_objections IS 'Objections extracted from this transcript';
COMMENT ON COLUMN meeting_transcriptions.extracted_pitch_points IS 'Pitch points identified in this transcript';
