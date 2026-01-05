import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// New prompts to add
const prompts = [
  // SCHEDULING CATEGORY
  {
    key: 'scheduler_email_system',
    name: 'Scheduler Email Generation',
    description: 'System prompt for generating professional meeting scheduling emails.',
    prompt_template: `You are an expert B2B sales email writer specializing in meeting scheduling.

Your emails are:
- Professional yet warm and approachable
- Concise but complete (respect recipient's time)
- Focused on value, not just logistics
- Natural sounding (not robotic or template-ish)

Industry context:
- Recipients are pest control and lawn care business owners/managers
- They're busy running operations and taking customer calls
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
- Look at TODAY'S DATE in the prompt. Use THAT year in any seasonal greetings.
- If today is December 2025, write "end of 2025", NOT "end of 2024"
- If today is January 2026, write "start of 2026" or "new year", NOT "2025"
- NEVER guess the year - ALWAYS check the TODAY'S DATE provided in the prompt

IMPORTANT: Generate actual email content, not placeholders. Use the provided context to personalize.`,
    category: 'scheduling',
    purpose: 'System prompt for AI-generated scheduling emails. Controls tone, structure, and formatting of all meeting invitation emails.',
    variables: ['recipientName', 'recipientTitle', 'companyName', 'meetingType', 'proposedTimes', 'senderName'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
  },
  {
    key: 'scheduler_response_parsing',
    name: 'Scheduler Response Parsing',
    description: 'Parses incoming email responses to scheduling requests to detect intent and extract selected times.',
    prompt_template: `Analyze this email response to a meeting scheduling request.

TODAY'S DATE: {{todayFormatted}}
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
4. If questioning: What is their question?
5. Overall sentiment toward the meeting`,
    schema_template: JSON.stringify({
      intent: "accept|decline|counter_propose|question|unclear",
      selectedTime: "ISO timestamp if they selected a specific time",
      counterProposedTimes: ["Array of times they suggested if counter-proposing"],
      question: "Their question if asking one",
      sentiment: "positive|neutral|negative",
      reasoning: "Brief explanation of your analysis"
    }, null, 2),
    category: 'scheduling',
    purpose: 'Analyzes email responses to scheduling requests to detect accept/decline/counter-propose intent and extract time preferences.',
    variables: ['todayFormatted', 'yearGuidance', 'proposedTimes', 'emailBody'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
  },
  {
    key: 'meeting_prep_brief',
    name: 'Meeting Prep Brief',
    description: 'Generates comprehensive meeting prep briefs for sales calls including talking points, objection handling, and strategy.',
    prompt_template: `Generate a comprehensive meeting prep brief.

## Meeting Details
- Type: {{meetingType}}
- Company: {{companyName}}
{{companyContext}}

## Attendees
{{attendeeList}}

{{dealContext}}

{{previousMeetings}}

## Task
Create a detailed prep brief to help the sales rep succeed in this meeting.`,
    schema_template: JSON.stringify({
      executive_summary: "2-3 sentence overview of the opportunity",
      meeting_objective: "The ONE primary outcome we are trying to achieve",
      key_talking_points: ["3-5 specific points to cover"],
      questions_to_ask: ["4-6 strategic questions to uncover needs"],
      landmines_to_avoid: ["2-3 topics to be careful around"],
      objection_prep: [{ objection: "Common objection", response: "How to handle it" }],
      next_steps_to_propose: ["2-3 concrete next steps"],
      attendee_insights: [{ name: "Person name", title: "Their role", notes: "Key things to know" }]
    }, null, 2),
    category: 'scheduling',
    purpose: 'Creates detailed meeting preparation materials including executive summary, talking points, objection prep, and attendee insights.',
    variables: ['meetingType', 'companyName', 'companyContext', 'attendeeList', 'dealContext', 'previousMeetings'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
  },
  {
    key: 'persona_detection',
    name: 'Contact Persona Detection',
    description: 'Analyzes contact information to determine their communication persona type for personalized outreach.',
    prompt_template: `Analyze this contact and determine their likely persona type for B2B sales communication.

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
Determine the most likely persona and explain your reasoning.`,
    schema_template: JSON.stringify({
      persona: "one of the persona types listed",
      confidence: "0.0-1.0",
      signals: ["array of signals that indicated this persona"],
      reasoning: "brief explanation"
    }, null, 2),
    category: 'scheduling',
    purpose: 'Detects communication persona types (owner, office manager, executive, etc.) to personalize email tone and style.',
    variables: ['contactName', 'contactTitle', 'companyContext'],
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
  },

  // MEETINGS CATEGORY
  {
    key: 'transcript_sales_analysis',
    name: 'Transcript Sales Analysis',
    description: 'Analyzes sales call transcripts to extract products discussed, stage indicators, objections, and outcomes.',
    prompt_template: `You are a sales intelligence analyst. Analyze this sales call transcript and extract actionable insights.

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
{{transcriptContent}}`,
    schema_template: JSON.stringify({
      product_mentioned: "string - the product/service being discussed",
      stage_indicators: ["array of stage indicators"],
      objections_raised: [{ objection: "string", response: "string", was_handled: true }],
      effective_pitch_points: ["array of effective value props"],
      buying_signals: { positive: ["positive signals"], negative: ["negative signals"] },
      next_steps: ["array of next steps"],
      sentiment: "positive|neutral|negative|mixed",
      key_quotes: ["important quotes from the call"]
    }, null, 2),
    category: 'meetings',
    purpose: 'Extracts sales intelligence from call transcripts including stage indicators, objections, pitch points, and buying signals.',
    variables: ['companyName', 'productContext', 'transcriptContent'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
  },
  {
    key: 'command_center_meeting_prep',
    name: 'Quick Meeting Prep',
    description: 'Generates quick meeting prep content for the command center including objective, talking points, and discovery questions.',
    prompt_template: `Generate meeting prep for a sales meeting:

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

Be specific and actionable based on the context provided.`,
    schema_template: JSON.stringify({
      objective: "string",
      talking_points: ["string array - 3-5 items"],
      landmines: ["string array - 1-3 items"],
      questions_to_ask: ["string array - 2-4 items"]
    }, null, 2),
    category: 'meetings',
    purpose: 'Quick meeting prep for command center view - generates objective, talking points, and discovery questions.',
    variables: ['title', 'attendeeList', 'dealContext', 'recentContext'],
    model: 'claude-3-haiku-20240307',
    max_tokens: 800,
  },

  // INTELLIGENCE CATEGORY
  {
    key: 'entity_extraction_email',
    name: 'Email Company Extraction',
    description: 'Extracts company and business names mentioned in email content.',
    prompt_template: `Extract all company or business names mentioned in this email.

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
If no companies mentioned, return: []`,
    category: 'intelligence',
    purpose: 'Extracts company names from email signatures, body content, and references for entity matching.',
    variables: ['subject', 'bodyContent'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
  },
  {
    key: 'entity_matching_ai',
    name: 'AI Entity Matching',
    description: 'Uses AI to match communications to existing CRM companies and contacts.',
    prompt_template: `You are matching an incoming communication to existing CRM records.

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
- none: No match found, should create new record`,
    schema_template: JSON.stringify({
      company_match: {
        match_type: "exact|confident|probable|none",
        company_id: "uuid or null",
        reasoning: "Why this is the right company",
        confidence: "0.0-1.0"
      },
      contact_match: {
        match_type: "exact|confident|probable|none",
        contact_id: "uuid or null",
        reasoning: "Why this is the right contact",
        confidence: "0.0-1.0"
      },
      create_company: {
        should_create: true,
        suggested_name: "Company Name or null",
        suggested_domain: "domain.com or null",
        reasoning: "Why we should/should not create"
      },
      create_contact: {
        should_create: true,
        suggested_name: "Contact Name or null",
        suggested_email: "email or null",
        reasoning: "Why we should/should not create"
      },
      overall_confidence: "0.0-1.0",
      overall_reasoning: "Summary of matching logic"
    }, null, 2),
    category: 'intelligence',
    purpose: 'AI-powered matching of incoming communications to CRM companies and contacts with fuzzy matching and name variation handling.',
    variables: ['communicationType', 'fromEmail', 'fromName', 'subject', 'contentPreview', 'emailsMentioned', 'phonesMentioned', 'namesMentioned', 'companyMentions', 'domain', 'candidateCompanies', 'candidateContacts'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
  },

  // INBOX CATEGORY
  {
    key: 'inbound_email_analysis',
    name: 'Inbound Email Analysis',
    description: 'Comprehensive analysis of inbound emails with relationship intelligence context.',
    prompt_template: `Analyze this inbound email using the relationship context provided.

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

Consider the relationship history when analyzing - a long-time customer vs new lead changes interpretation.`,
    schema_template: JSON.stringify({
      summary: "1-2 sentence summary",
      sentiment: "positive|neutral|negative|urgent",
      priority: "high|medium|low",
      key_facts: ["array of key information"],
      buying_signals: { positive: ["positive indicators"], negative: ["negative indicators"] },
      concerns: ["concerns or objections"],
      competitors_mentioned: ["competitor names"],
      commitments: ["commitments made by either party"],
      questions: ["questions asked"],
      next_steps: ["suggested next steps"],
      suggested_action: "recommended action for rep",
      confidence: "0.0-1.0"
    }, null, 2),
    category: 'inbox',
    purpose: 'Deep analysis of inbound emails with relationship context for better signal detection and action recommendations.',
    variables: ['fromEmail', 'subject', 'date', 'bodyContent', 'relationshipContext'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
  },
  {
    key: 'communication_hub_analysis',
    name: 'Communication Hub Analysis',
    description: 'Analyzes inbound communications to extract facts, signals, objections, and next steps.',
    prompt_template: `Analyze this inbound communication and extract structured intelligence.

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

Be precise. Quote the source when possible. Do not infer beyond what is stated.`,
    schema_template: JSON.stringify({
      facts: [{ fact: "string", category: "string", confidence: "0.0-1.0" }],
      signals: [{ signal: "string", type: "positive|negative|neutral", strength: "strong|moderate|weak", confidence: "0.0-1.0" }],
      objections: [{ objection: "string", severity: "high|medium|low", addressed: true, confidence: "0.0-1.0" }],
      competitors: [{ name: "string", context: "string", confidence: "0.0-1.0" }],
      commitments: [{ commitment: "string", by: "us|them", due: "string or null", confidence: "0.0-1.0" }],
      next_steps: [{ step: "string", owner: "us|them|both", priority: "high|medium|low", confidence: "0.0-1.0" }],
      questions: ["array of questions needing answers"],
      overall_sentiment: "positive|neutral|negative|mixed",
      urgency: "high|medium|low"
    }, null, 2),
    category: 'inbox',
    purpose: 'Structured extraction of facts, signals, objections, and next steps from all communication types.',
    variables: ['communicationType', 'fromInfo', 'subject', 'date', 'content', 'contextSection'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
  },
];

async function run() {
  console.log('Adding new prompts to database...\n');

  for (const prompt of prompts) {
    // Check if prompt already exists
    const { data: existing } = await supabase
      .from('ai_prompts')
      .select('id')
      .eq('key', prompt.key)
      .maybeSingle();

    if (existing) {
      // Update existing prompt
      const { error } = await supabase
        .from('ai_prompts')
        .update({
          name: prompt.name,
          description: prompt.description,
          prompt_template: prompt.prompt_template,
          default_prompt_template: prompt.prompt_template,
          schema_template: prompt.schema_template || null,
          default_schema_template: prompt.schema_template || null,
          category: prompt.category,
          purpose: prompt.purpose,
          variables: prompt.variables,
          model: prompt.model,
          max_tokens: prompt.max_tokens,
          updated_at: new Date().toISOString(),
        })
        .eq('key', prompt.key);

      if (error) {
        console.log(`  [ERROR] ${prompt.key}: ${error.message}`);
      } else {
        console.log(`  [UPDATED] ${prompt.key}`);
      }
    } else {
      // Insert new prompt
      const { error } = await supabase
        .from('ai_prompts')
        .insert({
          key: prompt.key,
          name: prompt.name,
          description: prompt.description,
          prompt_template: prompt.prompt_template,
          default_prompt_template: prompt.prompt_template,
          schema_template: prompt.schema_template || null,
          default_schema_template: prompt.schema_template || null,
          category: prompt.category,
          purpose: prompt.purpose,
          variables: prompt.variables,
          model: prompt.model,
          max_tokens: prompt.max_tokens,
          is_active: true,
          version: 1,
        });

      if (error) {
        console.log(`  [ERROR] ${prompt.key}: ${error.message}`);
      } else {
        console.log(`  [ADDED] ${prompt.key}`);
      }
    }
  }

  console.log('\nDone! Run scripts/check-ai-prompts.ts to see all prompts.');
}

run().catch(console.error);
