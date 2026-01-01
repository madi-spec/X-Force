-- Add multi-provider support to ai_prompts table
-- This enables selection of Anthropic, OpenAI, or Gemini per prompt
-- with optional fallback configuration

-- Add provider columns to ai_prompts
ALTER TABLE ai_prompts
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'anthropic',
ADD COLUMN IF NOT EXISTS fallback_provider TEXT,
ADD COLUMN IF NOT EXISTS fallback_model TEXT;

-- Add constraint for valid providers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_provider'
  ) THEN
    ALTER TABLE ai_prompts
    ADD CONSTRAINT valid_provider
    CHECK (provider IN ('anthropic', 'openai', 'gemini'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_fallback_provider'
  ) THEN
    ALTER TABLE ai_prompts
    ADD CONSTRAINT valid_fallback_provider
    CHECK (fallback_provider IS NULL OR fallback_provider IN ('anthropic', 'openai', 'gemini'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN ai_prompts.provider IS 'AI provider: anthropic, openai, or gemini';
COMMENT ON COLUMN ai_prompts.fallback_provider IS 'Fallback provider if primary fails';
COMMENT ON COLUMN ai_prompts.fallback_model IS 'Model to use with fallback provider';

-- Also add to history table for tracking
ALTER TABLE ai_prompt_history
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS fallback_provider TEXT,
ADD COLUMN IF NOT EXISTS fallback_model TEXT;

-- Update existing prompts to have explicit provider (in case any are NULL)
UPDATE ai_prompts SET provider = 'anthropic' WHERE provider IS NULL;
