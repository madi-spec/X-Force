-- AI Prompts Management Tables
-- Allows editing AI prompts from the settings UI with version history

-- Main prompts table
CREATE TABLE ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  schema_template TEXT,
  default_prompt_template TEXT NOT NULL,
  default_schema_template TEXT,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- Version history table
CREATE TABLE ai_prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES ai_prompts(id) ON DELETE CASCADE,
  prompt_template TEXT NOT NULL,
  schema_template TEXT,
  version INTEGER NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_reason TEXT
);

-- Indexes
CREATE INDEX idx_ai_prompts_key ON ai_prompts(key);
CREATE INDEX idx_ai_prompt_history_prompt_id ON ai_prompt_history(prompt_id);
CREATE INDEX idx_ai_prompt_history_version ON ai_prompt_history(prompt_id, version DESC);

-- Enable RLS
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow authenticated users to read, admins to write
CREATE POLICY "Allow authenticated users to read prompts"
  ON ai_prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update prompts"
  ON ai_prompts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read prompt history"
  ON ai_prompt_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert prompt history"
  ON ai_prompt_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Seed default prompts

-- 1. Meeting Analysis Prompt
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template) VALUES (
  'meeting_analysis',
  'Meeting Analysis',
  'Analyzes meeting transcriptions to extract key points, action items, buying signals, objections, sentiment, and generates follow-up emails.',
  E'You are an expert sales analyst for a B2B SaaS company that sells voice phone systems and AI solutions to the pest control and lawn care industry. Analyze this meeting transcription and extract actionable intelligence.

## Meeting Information
- Title: {{title}}
- Date: {{meetingDate}}
- Attendees: {{attendees}}
{{contextSection}}

## Transcription
{{transcription}}

---

Analyze this meeting and provide a comprehensive JSON response with this exact structure. Be thorough and extract all relevant information:

```json
{
  "summary": "2-3 paragraph summary of the meeting covering key discussion points, outcomes, and next steps",
  "headline": "One sentence headline capturing the essence of the meeting",

  "keyPoints": [
    {"topic": "Topic discussed", "details": "What was said about this topic", "importance": "high|medium|low"}
  ],

  "stakeholders": [
    {
      "name": "Person Name",
      "role": "Their role/title if mentioned or inferred",
      "sentiment": "positive|neutral|negative",
      "keyQuotes": ["Notable things they said that reveal their position or concerns"]
    }
  ],

  "buyingSignals": [
    {"signal": "What indicates buying interest", "quote": "Exact or paraphrased quote if available", "strength": "strong|moderate|weak"}
  ],

  "objections": [
    {
      "objection": "The concern or objection raised",
      "context": "Why they raised this concern",
      "howAddressed": "How we responded to this or null if not addressed",
      "resolved": true or false
    }
  ],

  "actionItems": [
    {
      "task": "Specific actionable task",
      "owner": "us|them",
      "assignee": "Person name if mentioned or null",
      "dueDate": "Date if mentioned (YYYY-MM-DD format) or null",
      "priority": "high|medium|low"
    }
  ],

  "theirCommitments": [
    {"commitment": "What they promised to do", "who": "Person name", "when": "Timeframe or null"}
  ],

  "ourCommitments": [
    {"commitment": "What we promised to do", "when": "Timeframe or null"}
  ],

  "sentiment": {
    "overall": "very_positive|positive|neutral|negative|very_negative",
    "interestLevel": "high|medium|low",
    "urgency": "high|medium|low",
    "trustLevel": "established|building|uncertain"
  },

  "extractedInfo": {
    "companySize": "Number of employees/agents if mentioned or null",
    "currentSolution": "What they currently use or null",
    "budget": "Budget mentioned or null",
    "timeline": "When they want to decide/implement or null",
    "decisionProcess": "How decisions are made in their organization or null",
    "competitors": ["Any competitors mentioned"],
    "painPoints": ["Problems or challenges they mentioned"]
  },

  "recommendations": [
    {
      "type": "stage_change|deal_value|add_contact|schedule_meeting|send_content|other",
      "action": "What action to take",
      "reasoning": "Why this is recommended based on the meeting",
      "data": {"stage": "demo"}
    }
  ],

  "followUpEmail": {
    "subject": "Professional email subject line",
    "body": "Full email body with proper formatting, personalized based on the meeting discussion. Include specific references to what was discussed, any commitments made, and clear next steps.",
    "attachmentSuggestions": ["Documents or materials to attach based on the discussion"]
  },

  "confidence": 0.85
}
```

Important guidelines:
- Be specific and actionable in your analysis
- Quote directly from the transcript when possible to support your analysis
- Identify ALL action items, including implicit ones
- The follow-up email should be professional but warm, reference specific discussion points, and clearly state next steps
- Recommendations should be concrete and based on evidence from the meeting
- If information isn''t explicitly stated in the transcript, use null rather than guessing
- For the confidence score, consider how complete the transcript is and how clear the discussion was (0.0 to 1.0)
- Ensure all arrays have at least one item if relevant content exists, or empty arrays if none

Respond ONLY with the JSON object inside markdown code blocks, no other text.',
  NULL,
  E'You are an expert sales analyst for a B2B SaaS company that sells voice phone systems and AI solutions to the pest control and lawn care industry. Analyze this meeting transcription and extract actionable intelligence.

## Meeting Information
- Title: {{title}}
- Date: {{meetingDate}}
- Attendees: {{attendees}}
{{contextSection}}

## Transcription
{{transcription}}

---

Analyze this meeting and provide a comprehensive JSON response with this exact structure. Be thorough and extract all relevant information:

```json
{
  "summary": "2-3 paragraph summary of the meeting covering key discussion points, outcomes, and next steps",
  "headline": "One sentence headline capturing the essence of the meeting",

  "keyPoints": [
    {"topic": "Topic discussed", "details": "What was said about this topic", "importance": "high|medium|low"}
  ],

  "stakeholders": [
    {
      "name": "Person Name",
      "role": "Their role/title if mentioned or inferred",
      "sentiment": "positive|neutral|negative",
      "keyQuotes": ["Notable things they said that reveal their position or concerns"]
    }
  ],

  "buyingSignals": [
    {"signal": "What indicates buying interest", "quote": "Exact or paraphrased quote if available", "strength": "strong|moderate|weak"}
  ],

  "objections": [
    {
      "objection": "The concern or objection raised",
      "context": "Why they raised this concern",
      "howAddressed": "How we responded to this or null if not addressed",
      "resolved": true or false
    }
  ],

  "actionItems": [
    {
      "task": "Specific actionable task",
      "owner": "us|them",
      "assignee": "Person name if mentioned or null",
      "dueDate": "Date if mentioned (YYYY-MM-DD format) or null",
      "priority": "high|medium|low"
    }
  ],

  "theirCommitments": [
    {"commitment": "What they promised to do", "who": "Person name", "when": "Timeframe or null"}
  ],

  "ourCommitments": [
    {"commitment": "What we promised to do", "when": "Timeframe or null"}
  ],

  "sentiment": {
    "overall": "very_positive|positive|neutral|negative|very_negative",
    "interestLevel": "high|medium|low",
    "urgency": "high|medium|low",
    "trustLevel": "established|building|uncertain"
  },

  "extractedInfo": {
    "companySize": "Number of employees/agents if mentioned or null",
    "currentSolution": "What they currently use or null",
    "budget": "Budget mentioned or null",
    "timeline": "When they want to decide/implement or null",
    "decisionProcess": "How decisions are made in their organization or null",
    "competitors": ["Any competitors mentioned"],
    "painPoints": ["Problems or challenges they mentioned"]
  },

  "recommendations": [
    {
      "type": "stage_change|deal_value|add_contact|schedule_meeting|send_content|other",
      "action": "What action to take",
      "reasoning": "Why this is recommended based on the meeting",
      "data": {"stage": "demo"}
    }
  ],

  "followUpEmail": {
    "subject": "Professional email subject line",
    "body": "Full email body with proper formatting, personalized based on the meeting discussion. Include specific references to what was discussed, any commitments made, and clear next steps.",
    "attachmentSuggestions": ["Documents or materials to attach based on the discussion"]
  },

  "confidence": 0.85
}
```

Important guidelines:
- Be specific and actionable in your analysis
- Quote directly from the transcript when possible to support your analysis
- Identify ALL action items, including implicit ones
- The follow-up email should be professional but warm, reference specific discussion points, and clearly state next steps
- Recommendations should be concrete and based on evidence from the meeting
- If information isn''t explicitly stated in the transcript, use null rather than guessing
- For the confidence score, consider how complete the transcript is and how clear the discussion was (0.0 to 1.0)
- Ensure all arrays have at least one item if relevant content exists, or empty arrays if none

Respond ONLY with the JSON object inside markdown code blocks, no other text.',
  NULL
);

-- 2. Entity Matching Prompt
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template) VALUES (
  'entity_matching',
  'Entity Matching',
  'Matches meeting transcripts to existing companies and deals in the CRM based on names, contacts, and discussion topics.',
  E'You are analyzing a sales meeting transcript to determine which company and deal it should be associated with in our CRM.

## Meeting Title
{{title}}

## Meeting Participants
{{participantList}}

## Transcript
{{transcriptText}}

## Available Companies in CRM
{{companyList}}

## Active Deals in CRM
{{dealList}}

## Known Contacts
{{contactList}}

---

Analyze the transcript and determine:
1. Which company (if any) this meeting is about
2. Which deal (if any) this meeting should be associated with
3. Which sales team should handle this (voice_outside, voice_inside, or xrai)
4. Whether a human needs to review and manually assign this transcript

Look for:
- Company names mentioned in the conversation
- People''s names that match known contacts
- Discussion topics that relate to specific deals
- Industry context (pest control, lawn care)
- Product discussions (Voice, X-RAI, AI Agents)

Respond with JSON:',
  E'{
  "companyMatch": {
    "id": "UUID of matched company or null",
    "name": "Company name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this company was matched"]
  } | null,
  "dealMatch": {
    "id": "UUID of matched deal or null",
    "name": "Deal name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this deal was matched"]
  } | null,
  "suggestedSalesTeam": "voice_outside|voice_inside|xrai|null",
  "overallConfidence": 0.0-1.0,
  "reasoning": "Explanation of the matching logic",
  "extractedCompanyName": "Company name mentioned in transcript (even if not in CRM)",
  "extractedPersonNames": ["Names of people mentioned"],
  "extractedTopics": ["Key topics discussed"],
  "requiresHumanReview": true/false,
  "reviewReason": "Why human review is needed or null"
}

Important:
- Set requiresHumanReview=true if confidence < 0.6 or if there are multiple possible matches
- Set requiresHumanReview=true if a company is mentioned but doesn''t exist in the CRM
- Only match to a deal if you''re confident it''s the right one',
  E'You are analyzing a sales meeting transcript to determine which company and deal it should be associated with in our CRM.

## Meeting Title
{{title}}

## Meeting Participants
{{participantList}}

## Transcript
{{transcriptText}}

## Available Companies in CRM
{{companyList}}

## Active Deals in CRM
{{dealList}}

## Known Contacts
{{contactList}}

---

Analyze the transcript and determine:
1. Which company (if any) this meeting is about
2. Which deal (if any) this meeting should be associated with
3. Which sales team should handle this (voice_outside, voice_inside, or xrai)
4. Whether a human needs to review and manually assign this transcript

Look for:
- Company names mentioned in the conversation
- People''s names that match known contacts
- Discussion topics that relate to specific deals
- Industry context (pest control, lawn care)
- Product discussions (Voice, X-RAI, AI Agents)

Respond with JSON:',
  E'{
  "companyMatch": {
    "id": "UUID of matched company or null",
    "name": "Company name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this company was matched"]
  } | null,
  "dealMatch": {
    "id": "UUID of matched deal or null",
    "name": "Deal name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this deal was matched"]
  } | null,
  "suggestedSalesTeam": "voice_outside|voice_inside|xrai|null",
  "overallConfidence": 0.0-1.0,
  "reasoning": "Explanation of the matching logic",
  "extractedCompanyName": "Company name mentioned in transcript (even if not in CRM)",
  "extractedPersonNames": ["Names of people mentioned"],
  "extractedTopics": ["Key topics discussed"],
  "requiresHumanReview": true/false,
  "reviewReason": "Why human review is needed or null"
}

Important:
- Set requiresHumanReview=true if confidence < 0.6 or if there are multiple possible matches
- Set requiresHumanReview=true if a company is mentioned but doesn''t exist in the CRM
- Only match to a deal if you''re confident it''s the right one'
);

-- 3. Entity Extraction Prompt
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template) VALUES (
  'entity_extraction',
  'Entity Extraction',
  'Extracts company, contact, and deal information from transcripts to create new CRM records.',
  E'You are analyzing a sales meeting transcript to extract information for creating new CRM records.

## Context
This is for X-RAI Labs, which sells:
- Voice phone systems for pest control and lawn care companies
- X-RAI platform (call analytics, performance tracking)
- AI Agents (receptionist, dispatch, sales bots)

## Meeting Title
{{title}}

## Meeting Participants
{{participantList}}

## Transcript
{{transcriptText}}

---

Extract detailed information to create a new company, contacts, and deal in the CRM.

Look for:
- Company name (from conversation or email domains like @pestcompany.com)
- Industry (pest control, lawn care, or both)
- Company size hints (number of technicians, trucks, locations, call volume)
- People''s names, titles, and roles
- Products being discussed or demoed
- Budget or value hints
- Location information

Respond with JSON:',
  E'{
  "company": {
    "name": "Company name (required - extract from conversation or email domain)",
    "industry": "pest|lawn|both|null",
    "segment": "smb|mid_market|enterprise|pe_platform|franchisor|null (smb=1-5 agents, mid_market=6-20, enterprise=21-100, pe_platform=100+)",
    "estimatedAgentCount": number or null,
    "crmPlatform": "fieldroutes|pestpac|realgreen|null (if mentioned)",
    "website": "company website if mentioned or null",
    "city": "city if mentioned or null",
    "state": "2-letter state code if mentioned or null"
  },
  "contacts": [
    {
      "name": "Person''s full name",
      "email": "email if available or null",
      "title": "Job title if mentioned or null",
      "role": "decision_maker|influencer|champion|end_user|null",
      "isPrimary": true/false (mark the main contact as primary)
    }
  ],
  "deal": {
    "suggestedName": "Suggested deal name (usually company name)",
    "estimatedValue": number or null (based on company size and products discussed),
    "productInterests": ["Voice", "X-RAI", "AI Agents"] (which products were discussed),
    "salesTeam": "voice_outside|voice_inside|xrai|null",
    "notes": "Key notes about the opportunity"
  },
  "confidence": 0.0-1.0 (how confident are you in this extracted data)
}

Important:
- Always extract a company name - use email domain if no explicit name
- Include all participants as contacts
- Set isPrimary=true for the main point of contact
- Estimate deal value based on: SMB $5-15K, Mid-Market $15-50K, Enterprise $50-150K
- Set salesTeam based on primary product interest (Voice products = voice teams, X-RAI/AI = xrai)',
  E'You are analyzing a sales meeting transcript to extract information for creating new CRM records.

## Context
This is for X-RAI Labs, which sells:
- Voice phone systems for pest control and lawn care companies
- X-RAI platform (call analytics, performance tracking)
- AI Agents (receptionist, dispatch, sales bots)

## Meeting Title
{{title}}

## Meeting Participants
{{participantList}}

## Transcript
{{transcriptText}}

---

Extract detailed information to create a new company, contacts, and deal in the CRM.

Look for:
- Company name (from conversation or email domains like @pestcompany.com)
- Industry (pest control, lawn care, or both)
- Company size hints (number of technicians, trucks, locations, call volume)
- People''s names, titles, and roles
- Products being discussed or demoed
- Budget or value hints
- Location information

Respond with JSON:',
  E'{
  "company": {
    "name": "Company name (required - extract from conversation or email domain)",
    "industry": "pest|lawn|both|null",
    "segment": "smb|mid_market|enterprise|pe_platform|franchisor|null (smb=1-5 agents, mid_market=6-20, enterprise=21-100, pe_platform=100+)",
    "estimatedAgentCount": number or null,
    "crmPlatform": "fieldroutes|pestpac|realgreen|null (if mentioned)",
    "website": "company website if mentioned or null",
    "city": "city if mentioned or null",
    "state": "2-letter state code if mentioned or null"
  },
  "contacts": [
    {
      "name": "Person''s full name",
      "email": "email if available or null",
      "title": "Job title if mentioned or null",
      "role": "decision_maker|influencer|champion|end_user|null",
      "isPrimary": true/false (mark the main contact as primary)
    }
  ],
  "deal": {
    "suggestedName": "Suggested deal name (usually company name)",
    "estimatedValue": number or null (based on company size and products discussed),
    "productInterests": ["Voice", "X-RAI", "AI Agents"] (which products were discussed),
    "salesTeam": "voice_outside|voice_inside|xrai|null",
    "notes": "Key notes about the opportunity"
  },
  "confidence": 0.0-1.0 (how confident are you in this extracted data)
}

Important:
- Always extract a company name - use email domain if no explicit name
- Include all participants as contacts
- Set isPrimary=true for the main point of contact
- Estimate deal value based on: SMB $5-15K, Mid-Market $15-50K, Enterprise $50-150K
- Set salesTeam based on primary product interest (Voice products = voice teams, X-RAI/AI = xrai)'
);
