-- Comprehensive AI Prompts Migration
-- Adds all remaining hardcoded prompts to the database for UI management
-- Organized by category for better navigation

-- ============================================
-- CATEGORY: SCHEDULING
-- Prompts related to meeting scheduling and calendar management
-- ============================================

-- 1. Scheduler Email Generation System Prompt
INSERT INTO ai_prompts (key, name, description, prompt_template, default_prompt_template, category, purpose, variables, model, max_tokens) VALUES (
  'scheduler_email_system',
  'Scheduler Email Generation',
  'System prompt for generating professional meeting scheduling emails.',
  E'You are an expert B2B sales email writer specializing in meeting scheduling.

Your emails are:
- Professional yet warm and approachable
- Concise but complete (respect recipient''s time)
- Focused on value, not just logistics
- Natural sounding (not robotic or template-ish)

Industry context:
- Recipients are pest control and lawn care business owners/managers
- They''re busy running operations and taking customer calls
- They value directness and practical outcomes
- Avoid corporate jargon; be authentic

Email structure best practices:
- Subject: Clear, specific, creates curiosity (max 50 chars)
- Opening: Personal connection or context (1-2 sentences)
- Body: Clear purpose and value proposition
- Times: Present cleanly with timezone noted
- Close: Single clear call to action
- Signature: Professional but brief

For time proposals:
- Always include day of week for clarity
- Use 12-hour format with timezone
- Offer 3-4 options spanning different days/times
- Present in an easy-to-scan format

CRITICAL DATE HANDLING - READ CAREFULLY:
- The current date and year is provided in the prompt - USE IT EXACTLY
- The proposed times show VERIFIED day/date pairs - they are CORRECT
- When you write the email, use the EXACT same dates provided
- Do NOT add 1 to dates. Do NOT "fix" dates. Trust the input.

CRITICAL YEAR HANDLING:
- Look at TODAY''S DATE in the prompt. Use THAT year in any seasonal greetings.
- If today is December 2025, write "end of 2025", NOT "end of 2024"
- If today is January 2026, write "start of 2026" or "new year", NOT "2025"
- NEVER guess the year - ALWAYS check the TODAY''S DATE provided in the prompt
- Around the holidays, be especially careful: "Hope you''re having a great holiday season" is safer than referencing a specific year incorrectly.

IMPORTANT: Generate actual email content, not placeholders. Use the provided context to personalize.',
  E'You are an expert B2B sales email writer specializing in meeting scheduling.

Your emails are:
- Professional yet warm and approachable
- Concise but complete (respect recipient''s time)
- Focused on value, not just logistics
- Natural sounding (not robotic or template-ish)

Industry context:
- Recipients are pest control and lawn care business owners/managers
- They''re busy running operations and taking customer calls
- They value directness and practical outcomes
- Avoid corporate jargon; be authentic

Email structure best practices:
- Subject: Clear, specific, creates curiosity (max 50 chars)
- Opening: Personal connection or context (1-2 sentences)
- Body: Clear purpose and value proposition
- Times: Present cleanly with timezone noted
- Close: Single clear call to action
- Signature: Professional but brief

For time proposals:
- Always include day of week for clarity
- Use 12-hour format with timezone
- Offer 3-4 options spanning different days/times
- Present in an easy-to-scan format

CRITICAL DATE HANDLING - READ CAREFULLY:
- The current date and year is provided in the prompt - USE IT EXACTLY
- The proposed times show VERIFIED day/date pairs - they are CORRECT
- When you write the email, use the EXACT same dates provided
- Do NOT add 1 to dates. Do NOT "fix" dates. Trust the input.

CRITICAL YEAR HANDLING:
- Look at TODAY''S DATE in the prompt. Use THAT year in any seasonal greetings.
- If today is December 2025, write "end of 2025", NOT "end of 2024"
- If today is January 2026, write "start of 2026" or "new year", NOT "2025"
- NEVER guess the year - ALWAYS check the TODAY''S DATE provided in the prompt
- Around the holidays, be especially careful: "Hope you''re having a great holiday season" is safer than referencing a specific year incorrectly.

IMPORTANT: Generate actual email content, not placeholders. Use the provided context to personalize.',
  'scheduling',
  'System prompt for AI-generated scheduling emails. Controls tone, structure, and formatting of all meeting invitation emails.',
  ARRAY['recipientName', 'recipientTitle', 'companyName', 'meetingType', 'proposedTimes', 'senderName'],
  'claude-sonnet-4-20250514',
  2000
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- 2. Scheduler Response Parsing
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'scheduler_response_parsing',
  'Scheduler Response Parsing',
  'Parses incoming email responses to scheduling requests to detect intent and extract selected times.',
  E'Analyze this email response to a meeting scheduling request.

TODAY''S DATE: {{todayFormatted}}
{{yearGuidance}}

## Proposed Times
{{proposedTimes}}

## Email Response
{{emailBody}}

## Task
Determine:
1. Intent: Are they accepting a time, declining, proposing alternatives, asking a question, or unclear?
2. If accepting: Which specific time did they select?
3. If counter-proposing: What times are they suggesting? Return these as ISO timestamps
   - IMPORTANT: When they say "Monday the 5th" - the NUMBER 5th is the key, find the month where the 5th is (near) a Monday
4. If questioning: What is their question?
5. Overall sentiment toward the meeting',
  E'{
  "intent": "accept|decline|counter_propose|question|unclear",
  "selectedTime": "ISO timestamp if they selected a specific time",
  "counterProposedTimes": ["Array of times they suggested if counter-proposing"],
  "question": "Their question if asking one",
  "sentiment": "positive|neutral|negative",
  "reasoning": "Brief explanation of your analysis"
}',
  E'Analyze this email response to a meeting scheduling request.

TODAY''S DATE: {{todayFormatted}}
{{yearGuidance}}

## Proposed Times
{{proposedTimes}}

## Email Response
{{emailBody}}

## Task
Determine:
1. Intent: Are they accepting a time, declining, proposing alternatives, asking a question, or unclear?
2. If accepting: Which specific time did they select?
3. If counter-proposing: What times are they suggesting? Return these as ISO timestamps
   - IMPORTANT: When they say "Monday the 5th" - the NUMBER 5th is the key, find the month where the 5th is (near) a Monday
4. If questioning: What is their question?
5. Overall sentiment toward the meeting',
  E'{
  "intent": "accept|decline|counter_propose|question|unclear",
  "selectedTime": "ISO timestamp if they selected a specific time",
  "counterProposedTimes": ["Array of times they suggested if counter-proposing"],
  "question": "Their question if asking one",
  "sentiment": "positive|neutral|negative",
  "reasoning": "Brief explanation of your analysis"
}',
  'scheduling',
  'Analyzes email responses to scheduling requests to detect accept/decline/counter-propose intent and extract time preferences.',
  ARRAY['todayFormatted', 'yearGuidance', 'proposedTimes', 'emailBody'],
  'claude-sonnet-4-20250514',
  1000
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- 3. Meeting Prep Brief Generation
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'meeting_prep_brief',
  'Meeting Prep Brief',
  'Generates comprehensive meeting prep briefs for sales calls including talking points, objection handling, and strategy.',
  E'Generate a comprehensive meeting prep brief.

## Meeting Details
- Type: {{meetingType}}
- Company: {{companyName}}
{{companyContext}}

## Attendees
{{attendeeList}}

{{dealContext}}

{{previousMeetings}}

## Task
Create a detailed prep brief to help the sales rep succeed in this meeting.',
  E'{
  "executive_summary": "2-3 sentence overview of the opportunity",
  "meeting_objective": "The ONE primary outcome we are trying to achieve",
  "key_talking_points": ["3-5 specific points to cover"],
  "questions_to_ask": ["4-6 strategic questions to uncover needs"],
  "landmines_to_avoid": ["2-3 topics to be careful around"],
  "objection_prep": [
    { "objection": "Common objection", "response": "How to handle it" }
  ],
  "next_steps_to_propose": ["2-3 concrete next steps"],
  "attendee_insights": [
    { "name": "Person name", "title": "Their role", "notes": "Key things to know" }
  ]
}',
  E'Generate a comprehensive meeting prep brief.

## Meeting Details
- Type: {{meetingType}}
- Company: {{companyName}}
{{companyContext}}

## Attendees
{{attendeeList}}

{{dealContext}}

{{previousMeetings}}

## Task
Create a detailed prep brief to help the sales rep succeed in this meeting.',
  E'{
  "executive_summary": "2-3 sentence overview of the opportunity",
  "meeting_objective": "The ONE primary outcome we are trying to achieve",
  "key_talking_points": ["3-5 specific points to cover"],
  "questions_to_ask": ["4-6 strategic questions to uncover needs"],
  "landmines_to_avoid": ["2-3 topics to be careful around"],
  "objection_prep": [
    { "objection": "Common objection", "response": "How to handle it" }
  ],
  "next_steps_to_propose": ["2-3 concrete next steps"],
  "attendee_insights": [
    { "name": "Person name", "title": "Their role", "notes": "Key things to know" }
  ]
}',
  'scheduling',
  'Creates detailed meeting preparation materials including executive summary, talking points, objection prep, and attendee insights.',
  ARRAY['meetingType', 'companyName', 'companyContext', 'attendeeList', 'dealContext', 'previousMeetings'],
  'claude-sonnet-4-20250514',
  2500
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- 4. Persona Detection
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'persona_detection',
  'Contact Persona Detection',
  'Analyzes contact information to determine their communication persona type for personalized outreach.',
  E'Analyze this contact and determine their likely persona type for B2B sales communication.

## Contact Information
- Name: {{contactName}}
- Title: {{contactTitle}}
{{companyContext}}

## Persona Types (choose one)
1. owner_operator - Busy owner, direct communication, values time
2. office_manager - Detail-oriented, follows process, needs to check with decision maker
3. operations_lead - Efficiency-focused, data-driven, cares about ROI
4. it_technical - Technical details matter, wants specifics and integrations
5. executive - High-level, strategic, very brief communications
6. franchise_corp - Multi-location focus, scalability, enterprise needs

## Task
Determine the most likely persona and explain your reasoning.',
  E'{
  "persona": "one of the persona types listed",
  "confidence": 0.0-1.0,
  "signals": ["array of signals that indicated this persona"],
  "reasoning": "brief explanation"
}',
  E'Analyze this contact and determine their likely persona type for B2B sales communication.

## Contact Information
- Name: {{contactName}}
- Title: {{contactTitle}}
{{companyContext}}

## Persona Types (choose one)
1. owner_operator - Busy owner, direct communication, values time
2. office_manager - Detail-oriented, follows process, needs to check with decision maker
3. operations_lead - Efficiency-focused, data-driven, cares about ROI
4. it_technical - Technical details matter, wants specifics and integrations
5. executive - High-level, strategic, very brief communications
6. franchise_corp - Multi-location focus, scalability, enterprise needs

## Task
Determine the most likely persona and explain your reasoning.',
  E'{
  "persona": "one of the persona types listed",
  "confidence": 0.0-1.0,
  "signals": ["array of signals that indicated this persona"],
  "reasoning": "brief explanation"
}',
  'scheduling',
  'Detects communication persona types (owner, office manager, executive, etc.) to personalize email tone and style.',
  ARRAY['contactName', 'contactTitle', 'companyContext'],
  'claude-3-haiku-20240307',
  500
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- ============================================
-- CATEGORY: MEETINGS
-- Prompts related to meeting analysis and transcripts
-- ============================================

-- 5. Transcript Sales Analysis
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'transcript_sales_analysis',
  'Transcript Sales Analysis',
  'Analyzes sales call transcripts to extract products discussed, stage indicators, objections, and outcomes.',
  E'You are a sales intelligence analyst. Analyze this sales call transcript and extract actionable insights.

Company: {{companyName}}
{{productContext}}

Extract:
1. What product/service is being discussed
2. What stage of the sales process this appears to be
3. Any objections the prospect raised and how they were handled
4. Effective pitch points or value props mentioned
5. Positive and negative buying signals
6. Next steps mentioned
7. Overall sentiment

Be specific and quote the transcript where relevant.

Analyze this transcript:
{{transcriptContent}}',
  E'{
  "product_mentioned": "string - the product/service being discussed",
  "stage_indicators": ["array of stage indicators"],
  "objections_raised": [
    { "objection": "string", "response": "string", "was_handled": true/false }
  ],
  "effective_pitch_points": ["array of effective value props"],
  "buying_signals": {
    "positive": ["positive signals"],
    "negative": ["negative signals"]
  },
  "next_steps": ["array of next steps"],
  "sentiment": "positive|neutral|negative|mixed",
  "key_quotes": ["important quotes from the call"]
}',
  E'You are a sales intelligence analyst. Analyze this sales call transcript and extract actionable insights.

Company: {{companyName}}
{{productContext}}

Extract:
1. What product/service is being discussed
2. What stage of the sales process this appears to be
3. Any objections the prospect raised and how they were handled
4. Effective pitch points or value props mentioned
5. Positive and negative buying signals
6. Next steps mentioned
7. Overall sentiment

Be specific and quote the transcript where relevant.

Analyze this transcript:
{{transcriptContent}}',
  E'{
  "product_mentioned": "string - the product/service being discussed",
  "stage_indicators": ["array of stage indicators"],
  "objections_raised": [
    { "objection": "string", "response": "string", "was_handled": true/false }
  ],
  "effective_pitch_points": ["array of effective value props"],
  "buying_signals": {
    "positive": ["positive signals"],
    "negative": ["negative signals"]
  },
  "next_steps": ["array of next steps"],
  "sentiment": "positive|neutral|negative|mixed",
  "key_quotes": ["important quotes from the call"]
}',
  'meetings',
  'Extracts sales intelligence from call transcripts including stage indicators, objections, pitch points, and buying signals.',
  ARRAY['companyName', 'productContext', 'transcriptContent'],
  'claude-sonnet-4-20250514',
  2000
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- 6. Command Center Meeting Prep (simpler version)
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'command_center_meeting_prep',
  'Quick Meeting Prep',
  'Generates quick meeting prep content for the command center including objective, talking points, and discovery questions.',
  E'Generate meeting prep for a sales meeting:

MEETING: {{title}}

ATTENDEES:
{{attendeeList}}

{{dealContext}}

{{recentContext}}

Generate:
1. objective: A clear, specific objective for this meeting (1-2 sentences)
2. talking_points: 3-5 key points to discuss
3. landmines: 1-3 topics to avoid or handle carefully (if any)
4. questions_to_ask: 2-4 good discovery questions

Be specific and actionable based on the context provided.',
  E'{
  "objective": "string",
  "talking_points": ["string array - 3-5 items"],
  "landmines": ["string array - 1-3 items"],
  "questions_to_ask": ["string array - 2-4 items"]
}',
  E'Generate meeting prep for a sales meeting:

MEETING: {{title}}

ATTENDEES:
{{attendeeList}}

{{dealContext}}

{{recentContext}}

Generate:
1. objective: A clear, specific objective for this meeting (1-2 sentences)
2. talking_points: 3-5 key points to discuss
3. landmines: 1-3 topics to avoid or handle carefully (if any)
4. questions_to_ask: 2-4 good discovery questions

Be specific and actionable based on the context provided.',
  E'{
  "objective": "string",
  "talking_points": ["string array - 3-5 items"],
  "landmines": ["string array - 1-3 items"],
  "questions_to_ask": ["string array - 2-4 items"]
}',
  'meetings',
  'Quick meeting prep for command center view - generates objective, talking points, and discovery questions.',
  ARRAY['title', 'attendeeList', 'dealContext', 'recentContext'],
  'claude-3-haiku-20240307',
  800
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- ============================================
-- CATEGORY: INTELLIGENCE
-- Prompts related to entity matching and company research
-- ============================================

-- 7. Entity Extraction from Email
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'entity_extraction_email',
  'Email Company Extraction',
  'Extracts company and business names mentioned in email content.',
  E'Extract all company or business names mentioned in this email.

Look for:
- Company names in the signature
- Company names mentioned in the body
- Business names referenced (e.g., "On The Fly Pest Solutions", "ABC Pest Control")
- Franchise names with location qualifiers (e.g., "Lawn Doctor of Boston")

DO NOT include:
- Personal names (unless they are clearly a business name)
- Generic terms like "pest control company" or "the business"
- Your own company name if mentioned

Subject: {{subject}}

Body:
{{bodyContent}}

Return ONLY a JSON array of company names. No other text.
Example: ["Acme Corp", "TechStart Inc"]
If no companies mentioned, return: []',
  E'["array of company names found"]',
  E'Extract all company or business names mentioned in this email.

Look for:
- Company names in the signature
- Company names mentioned in the body
- Business names referenced (e.g., "On The Fly Pest Solutions", "ABC Pest Control")
- Franchise names with location qualifiers (e.g., "Lawn Doctor of Boston")

DO NOT include:
- Personal names (unless they are clearly a business name)
- Generic terms like "pest control company" or "the business"
- Your own company name if mentioned

Subject: {{subject}}

Body:
{{bodyContent}}

Return ONLY a JSON array of company names. No other text.
Example: ["Acme Corp", "TechStart Inc"]
If no companies mentioned, return: []',
  E'["array of company names found"]',
  'intelligence',
  'Extracts company names from email signatures, body content, and references for entity matching.',
  ARRAY['subject', 'bodyContent'],
  'claude-sonnet-4-20250514',
  500
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- 8. AI Entity Matching
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'entity_matching_ai',
  'AI Entity Matching',
  'Uses AI to match communications to existing CRM companies and contacts.',
  E'You are matching an incoming communication to existing CRM records.

## THE COMMUNICATION
Type: {{communicationType}}
From: {{fromEmail}}{{fromName}}
Subject: {{subject}}
Content Preview:
{{contentPreview}}

## RAW IDENTIFIERS EXTRACTED
Emails mentioned: {{emailsMentioned}}
Phones mentioned: {{phonesMentioned}}
Names mentioned: {{namesMentioned}}
Company mentions: {{companyMentions}}
Email domain: {{domain}}

## CANDIDATE COMPANIES IN OUR CRM
{{candidateCompanies}}

## CANDIDATE CONTACTS IN OUR CRM
{{candidateContacts}}

## YOUR TASK

Determine which company and contact this communication is from/about.

Consider:
- Email domain matches (lawndoctorma.com -> Lawn Doctor)
- Name variations (Andy = Andrew, Rob = Robert, Bill = William, etc.)
- Company name variations (Lawn Doctor of Hanover = Lawn Doctor Hanover)
- Context clues ("Following up on our demo" = existing relationship)
- Franchise/location qualifiers
- When someone uses personal email but company is clear from content
- Signatures in the email body

Match types:
- exact: Email or phone directly matches a record
- confident: Strong signals (domain + name match, clear context)
- probable: Good signals but some ambiguity
- none: No match found, should create new record',
  E'{
  "company_match": {
    "match_type": "exact|confident|probable|none",
    "company_id": "uuid or null",
    "reasoning": "Why this is the right company",
    "confidence": 0.0-1.0
  },
  "contact_match": {
    "match_type": "exact|confident|probable|none",
    "contact_id": "uuid or null",
    "reasoning": "Why this is the right contact",
    "confidence": 0.0-1.0
  },
  "create_company": {
    "should_create": true/false,
    "suggested_name": "Company Name or null",
    "suggested_domain": "domain.com or null",
    "suggested_industry": "industry if determinable or null",
    "reasoning": "Why we should/should not create"
  },
  "create_contact": {
    "should_create": true/false,
    "suggested_name": "Contact Name or null",
    "suggested_email": "email or null",
    "suggested_phone": "phone or null",
    "suggested_title": "title if known or null",
    "reasoning": "Why we should/should not create"
  },
  "overall_confidence": 0.0-1.0,
  "overall_reasoning": "Summary of matching logic"
}',
  E'You are matching an incoming communication to existing CRM records.

## THE COMMUNICATION
Type: {{communicationType}}
From: {{fromEmail}}{{fromName}}
Subject: {{subject}}
Content Preview:
{{contentPreview}}

## RAW IDENTIFIERS EXTRACTED
Emails mentioned: {{emailsMentioned}}
Phones mentioned: {{phonesMentioned}}
Names mentioned: {{namesMentioned}}
Company mentions: {{companyMentions}}
Email domain: {{domain}}

## CANDIDATE COMPANIES IN OUR CRM
{{candidateCompanies}}

## CANDIDATE CONTACTS IN OUR CRM
{{candidateContacts}}

## YOUR TASK

Determine which company and contact this communication is from/about.

Consider:
- Email domain matches (lawndoctorma.com -> Lawn Doctor)
- Name variations (Andy = Andrew, Rob = Robert, Bill = William, etc.)
- Company name variations (Lawn Doctor of Hanover = Lawn Doctor Hanover)
- Context clues ("Following up on our demo" = existing relationship)
- Franchise/location qualifiers
- When someone uses personal email but company is clear from content
- Signatures in the email body

Match types:
- exact: Email or phone directly matches a record
- confident: Strong signals (domain + name match, clear context)
- probable: Good signals but some ambiguity
- none: No match found, should create new record',
  E'{
  "company_match": {
    "match_type": "exact|confident|probable|none",
    "company_id": "uuid or null",
    "reasoning": "Why this is the right company",
    "confidence": 0.0-1.0
  },
  "contact_match": {
    "match_type": "exact|confident|probable|none",
    "contact_id": "uuid or null",
    "reasoning": "Why this is the right contact",
    "confidence": 0.0-1.0
  },
  "create_company": {
    "should_create": true/false,
    "suggested_name": "Company Name or null",
    "suggested_domain": "domain.com or null",
    "suggested_industry": "industry if determinable or null",
    "reasoning": "Why we should/should not create"
  },
  "create_contact": {
    "should_create": true/false,
    "suggested_name": "Contact Name or null",
    "suggested_email": "email or null",
    "suggested_phone": "phone or null",
    "suggested_title": "title if known or null",
    "reasoning": "Why we should/should not create"
  },
  "overall_confidence": 0.0-1.0,
  "overall_reasoning": "Summary of matching logic"
}',
  'intelligence',
  'AI-powered matching of incoming communications to CRM companies and contacts with fuzzy matching and name variation handling.',
  ARRAY['communicationType', 'fromEmail', 'fromName', 'subject', 'contentPreview', 'emailsMentioned', 'phonesMentioned', 'namesMentioned', 'companyMentions', 'domain', 'candidateCompanies', 'candidateContacts'],
  'claude-sonnet-4-20250514',
  1500
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- ============================================
-- CATEGORY: INBOX
-- Prompts related to email processing and communication analysis
-- ============================================

-- 9. Inbound Email Analysis with Context
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'inbound_email_analysis',
  'Inbound Email Analysis',
  'Comprehensive analysis of inbound emails with relationship intelligence context.',
  E'Analyze this inbound email using the relationship context provided.

## EMAIL
From: {{fromEmail}}
Subject: {{subject}}
Date: {{date}}

Body:
{{bodyContent}}

## RELATIONSHIP CONTEXT
{{relationshipContext}}

## ANALYSIS REQUIREMENTS

Extract:
1. Key facts and information shared
2. Buying signals (positive and negative)
3. Concerns or objections raised
4. Competitor mentions
5. Commitments or promises made
6. Questions asked
7. Next steps mentioned or needed
8. Overall sentiment and urgency
9. Suggested actions for sales rep

Consider the relationship history when analyzing - a long-time customer vs new lead changes interpretation.',
  E'{
  "summary": "1-2 sentence summary",
  "sentiment": "positive|neutral|negative|urgent",
  "priority": "high|medium|low",
  "key_facts": ["array of key information"],
  "buying_signals": {
    "positive": ["positive indicators"],
    "negative": ["negative indicators"]
  },
  "concerns": ["concerns or objections"],
  "competitors_mentioned": ["competitor names"],
  "commitments": ["commitments made by either party"],
  "questions": ["questions asked"],
  "next_steps": ["suggested next steps"],
  "suggested_action": "recommended action for rep",
  "confidence": 0.0-1.0
}',
  E'Analyze this inbound email using the relationship context provided.

## EMAIL
From: {{fromEmail}}
Subject: {{subject}}
Date: {{date}}

Body:
{{bodyContent}}

## RELATIONSHIP CONTEXT
{{relationshipContext}}

## ANALYSIS REQUIREMENTS

Extract:
1. Key facts and information shared
2. Buying signals (positive and negative)
3. Concerns or objections raised
4. Competitor mentions
5. Commitments or promises made
6. Questions asked
7. Next steps mentioned or needed
8. Overall sentiment and urgency
9. Suggested actions for sales rep

Consider the relationship history when analyzing - a long-time customer vs new lead changes interpretation.',
  E'{
  "summary": "1-2 sentence summary",
  "sentiment": "positive|neutral|negative|urgent",
  "priority": "high|medium|low",
  "key_facts": ["array of key information"],
  "buying_signals": {
    "positive": ["positive indicators"],
    "negative": ["negative indicators"]
  },
  "concerns": ["concerns or objections"],
  "competitors_mentioned": ["competitor names"],
  "commitments": ["commitments made by either party"],
  "questions": ["questions asked"],
  "next_steps": ["suggested next steps"],
  "suggested_action": "recommended action for rep",
  "confidence": 0.0-1.0
}',
  'inbox',
  'Deep analysis of inbound emails with relationship context for better signal detection and action recommendations.',
  ARRAY['fromEmail', 'subject', 'date', 'bodyContent', 'relationshipContext'],
  'claude-sonnet-4-20250514',
  1500
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- 10. Communication Hub Analysis
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template, category, purpose, variables, model, max_tokens) VALUES (
  'communication_hub_analysis',
  'Communication Hub Analysis',
  'Analyzes inbound communications to extract facts, signals, objections, and next steps.',
  E'Analyze this inbound communication and extract structured intelligence.

## COMMUNICATION
Type: {{communicationType}}
From: {{fromInfo}}
Subject: {{subject}}
Date: {{date}}

Content:
{{content}}

{{contextSection}}

## EXTRACTION REQUIREMENTS

Extract with confidence scores (0.0-1.0):

1. FACTS: Concrete information shared (company size, timeline, budget, etc.)
2. SIGNALS: Buying signals, intent indicators, engagement level
3. OBJECTIONS: Concerns, hesitations, blockers mentioned
4. COMPETITORS: Any competitor mentions or comparisons
5. COMMITMENTS: Promises or commitments made by either party
6. NEXT STEPS: Explicit or implied next actions
7. QUESTIONS: Questions that need answers

Be precise. Quote the source when possible. Do not infer beyond what is stated.',
  E'{
  "facts": [
    { "fact": "string", "category": "string", "confidence": 0.0-1.0 }
  ],
  "signals": [
    { "signal": "string", "type": "positive|negative|neutral", "strength": "strong|moderate|weak", "confidence": 0.0-1.0 }
  ],
  "objections": [
    { "objection": "string", "severity": "high|medium|low", "addressed": true/false, "confidence": 0.0-1.0 }
  ],
  "competitors": [
    { "name": "string", "context": "string", "confidence": 0.0-1.0 }
  ],
  "commitments": [
    { "commitment": "string", "by": "us|them", "due": "string or null", "confidence": 0.0-1.0 }
  ],
  "next_steps": [
    { "step": "string", "owner": "us|them|both", "priority": "high|medium|low", "confidence": 0.0-1.0 }
  ],
  "questions": ["array of questions needing answers"],
  "overall_sentiment": "positive|neutral|negative|mixed",
  "urgency": "high|medium|low"
}',
  E'Analyze this inbound communication and extract structured intelligence.

## COMMUNICATION
Type: {{communicationType}}
From: {{fromInfo}}
Subject: {{subject}}
Date: {{date}}

Content:
{{content}}

{{contextSection}}

## EXTRACTION REQUIREMENTS

Extract with confidence scores (0.0-1.0):

1. FACTS: Concrete information shared (company size, timeline, budget, etc.)
2. SIGNALS: Buying signals, intent indicators, engagement level
3. OBJECTIONS: Concerns, hesitations, blockers mentioned
4. COMPETITORS: Any competitor mentions or comparisons
5. COMMITMENTS: Promises or commitments made by either party
6. NEXT STEPS: Explicit or implied next actions
7. QUESTIONS: Questions that need answers

Be precise. Quote the source when possible. Do not infer beyond what is stated.',
  E'{
  "facts": [
    { "fact": "string", "category": "string", "confidence": 0.0-1.0 }
  ],
  "signals": [
    { "signal": "string", "type": "positive|negative|neutral", "strength": "strong|moderate|weak", "confidence": 0.0-1.0 }
  ],
  "objections": [
    { "objection": "string", "severity": "high|medium|low", "addressed": true/false, "confidence": 0.0-1.0 }
  ],
  "competitors": [
    { "name": "string", "context": "string", "confidence": 0.0-1.0 }
  ],
  "commitments": [
    { "commitment": "string", "by": "us|them", "due": "string or null", "confidence": 0.0-1.0 }
  ],
  "next_steps": [
    { "step": "string", "owner": "us|them|both", "priority": "high|medium|low", "confidence": 0.0-1.0 }
  ],
  "questions": ["array of questions needing answers"],
  "overall_sentiment": "positive|neutral|negative|mixed",
  "urgency": "high|medium|low"
}',
  'inbox',
  'Structured extraction of facts, signals, objections, and next steps from all communication types.',
  ARRAY['communicationType', 'fromInfo', 'subject', 'date', 'content', 'contextSection'],
  'claude-sonnet-4-20250514',
  2000
) ON CONFLICT (key) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  updated_at = now();

-- ============================================
-- UPDATE DISPLAY ORDER FOR CATEGORIES
-- ============================================

-- Add display_order column if not exists
ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 100;

-- Set display order by category for better organization
UPDATE ai_prompts SET display_order =
  CASE category
    WHEN 'general' THEN 10
    WHEN 'scheduling' THEN 20
    WHEN 'meetings' THEN 30
    WHEN 'inbox' THEN 40
    WHEN 'intelligence' THEN 50
    WHEN 'daily_driver' THEN 60
    ELSE 100
  END;

-- Create index for display order
CREATE INDEX IF NOT EXISTS idx_ai_prompts_display_order ON ai_prompts(display_order, name);
