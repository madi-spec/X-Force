-- Email Intelligence Migration
-- Adds deep AI analysis capabilities to emails, matching transcript intelligence

-- ============================================
-- EMAIL MESSAGES: Add analysis tracking
-- ============================================

-- The ai_analysis JSONB column already exists for storing analysis
-- Add completion tracking and indexes
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS analysis_complete BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN email_messages.analysis_complete IS 'Whether deep AI analysis has been completed for this message';
COMMENT ON COLUMN email_messages.ai_analysis IS 'Deep AI analysis: request_type, summary, buying_signals, concerns, sentiment, etc.';

-- Index for finding unanalyzed inbound emails
CREATE INDEX IF NOT EXISTS idx_email_messages_unanalyzed
ON email_messages(user_id, is_sent_by_user, analysis_complete)
WHERE is_sent_by_user = FALSE AND analysis_complete = FALSE;

-- ============================================
-- COMMAND CENTER ITEMS: Add email intelligence fields
-- ============================================

-- Note: email_draft JSONB already exists from 20251220_command_center_rich_context.sql

ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS email_analysis JSONB,
ADD COLUMN IF NOT EXISTS buying_signals JSONB,
ADD COLUMN IF NOT EXISTS concerns JSONB,
ADD COLUMN IF NOT EXISTS suggested_actions JSONB;

-- Add comments for documentation
COMMENT ON COLUMN command_center_items.email_analysis IS 'AI analysis: request_type, summary, full_understanding, key_questions, urgency, sentiment, tone';
COMMENT ON COLUMN command_center_items.buying_signals IS 'Array of {signal, quote, strength, implication} detected in email';
COMMENT ON COLUMN command_center_items.concerns IS 'Array of {concern, quote, severity, suggested_response} detected in email';
COMMENT ON COLUMN command_center_items.suggested_actions IS 'Array of {action, priority, reasoning} recommended by AI';

-- Index for items with buying signals (for reporting)
CREATE INDEX IF NOT EXISTS idx_command_center_items_has_signals
ON command_center_items(user_id, created_at DESC)
WHERE buying_signals IS NOT NULL AND buying_signals != '[]'::jsonb;

-- ============================================
-- AI PROMPTS: Add email analysis prompt
-- ============================================

INSERT INTO ai_prompts (
  name,
  slug,
  category,
  purpose,
  variables,
  system_prompt,
  user_prompt_template,
  output_schema,
  model,
  max_tokens,
  temperature,
  is_active
) VALUES (
  'Email Deep Analysis',
  'email_deep_analysis',
  'email_analysis',
  'Performs deep AI analysis on inbound emails to extract buying signals, concerns, and generate response drafts',
  ARRAY['sender_name', 'sender_email', 'sender_title', 'company_name', 'company_industry', 'company_size', 'relationship_stage', 'last_contact_days', 'total_interactions', 'deal_name', 'deal_value', 'deal_stage', 'interaction_history', 'meeting_summaries', 'thread_context', 'subject', 'received_at', 'email_body'],
  'You are analyzing an inbound email for a sales team. Your job is to understand:
1. Who is this person and what''s our relationship?
2. What are they asking for or telling us?
3. What buying signals or concerns are present?
4. What should we do next?
5. Draft a response if appropriate.

Be specific - reference actual data from the context. Never be generic.',
  E'## CONTEXT ABOUT THE SENDER

<sender>
Name: {{sender_name}}
Email: {{sender_email}}
Title: {{sender_title}}
Company: {{company_name}}
Industry: {{company_industry}}
Company Size: {{company_size}}
</sender>

<relationship>
Stage: {{relationship_stage}}
Last Contact: {{last_contact_days}} days ago
Total Interactions: {{total_interactions}}
</relationship>

<active_deal>
Deal Name: {{deal_name}}
Value: ${{deal_value}}
Stage: {{deal_stage}}
</active_deal>

<recent_interactions>
{{interaction_history}}
</recent_interactions>

<recent_meeting_context>
{{meeting_summaries}}
</recent_meeting_context>

<email_thread>
{{thread_context}}
</email_thread>

## THE NEW EMAIL TO ANALYZE

Subject: {{subject}}
Date: {{received_at}}

{{email_body}}

---

Analyze this email and return JSON with the structure defined in the output schema.',
  '{
  "email_analysis": {
    "request_type": "demo_request | pricing_question | general_question | meeting_request | follow_up | complaint | info_share | introduction | other",
    "summary": "One sentence summary of what they want",
    "full_understanding": "2-3 sentences explaining the full context",
    "key_questions": ["Specific questions they asked"],
    "urgency": "High | Medium | Low",
    "sentiment": "Very Positive | Positive | Neutral | Concerned | Frustrated | Negative",
    "tone": "Brief description of their tone"
  },
  "buying_signals": [
    {
      "signal": "What the signal indicates",
      "quote": "Exact quote from email",
      "strength": "strong | moderate | weak",
      "implication": "What this means for the deal"
    }
  ],
  "concerns_detected": [
    {
      "concern": "What they are worried about",
      "quote": "Exact quote if available",
      "severity": "high | medium | low",
      "suggested_response": "How to address this"
    }
  ],
  "suggested_actions": [
    {
      "action": "Specific action to take",
      "priority": "high | medium | low",
      "reasoning": "Why this action"
    }
  ],
  "response_draft": {
    "subject": "Re: {original_subject}",
    "body": "Full draft email response"
  },
  "command_center_classification": {
    "tier": 1,
    "tier_trigger": "demo_request | pricing_request | email_reply | meeting_request",
    "sla_minutes": 120,
    "why_now": "One compelling sentence"
  }
}',
  'claude-sonnet-4-20250514',
  2000,
  0.7,
  true
) ON CONFLICT (slug) DO UPDATE SET
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  output_schema = EXCLUDED.output_schema,
  updated_at = NOW();
