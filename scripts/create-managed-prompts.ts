/**
 * Create the 3 new managed prompts for Phase 2 Prompt Management Remediation
 *
 * Run with: npx tsx scripts/create-managed-prompts.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define prompt templates
const CONTEXT_ENRICHMENT_PROMPT = `You are a sales strategist analyzing context for a sales action item.

ACTION TYPE: {{actionType}}
TITLE: {{title}}
TARGET: {{targetName}} at {{companyName}}

DEAL CONTEXT:
{{dealSnapshot}}
Weighted Value: {{weightedValue}}
Days Since Last Response: {{daysSinceResponse}}

RECENT EMAIL THREADS:
{{recentEmails}}

MEETING CONTEXT:
{{transcriptContext}}

ENGAGEMENT CONTEXT:
{{engagementContext}}

RECENT ACTIVITIES:
{{recentActivities}}

Analyze this context and provide:
1. A specific "why now" reason (ONE sentence with real data, or null if no specific urgency)
2. A 2-3 sentence context summary explaining the business case
3. 2-4 tactical considerations for this action

{{#if includeEmail}}
Also draft an email with:
- Subject line
- Body text
{{/if}}

Respond with JSON matching the schema.`;

const CONTEXT_ENRICHMENT_SCHEMA = `{
  "why_now": "string or null - ONE specific sentence with real data, or null if no specific reason",
  "context_summary": "string - 2-3 sentence business case",
  "considerations": ["string array - 2-4 specific tactical points"],
  "email_subject": "string - only if email requested",
  "email_body": "string - only if email requested"
}`;

const ACTION_RECONCILIATION_PROMPT = `You are an AI sales assistant helping reconcile actions from customer interactions.

SALES PLAYBOOK CONTEXT:
{{salesPlaybook}}

NEW INTERACTION:
- Type: {{interactionType}}
- Date: {{interactionDate}}
- Summary: {{interactionSummary}}
- Communication Type: {{communicationType}}
- Current Sales Stage: {{salesStage}}

REQUIRED ACTIONS FROM THIS INTERACTION:
{{requiredActions}}

EXISTING COMMAND CENTER ITEMS:
{{existingItems}}

RELATIONSHIP CONTEXT:
{{relationshipContext}}

TODAY'S DATE: {{today}}

Your job is to reconcile the required actions from this new interaction against the existing command center items.

For each EXISTING item, decide:
- "keep" - Item is still relevant and should remain unchanged
- "complete" - This interaction fulfills/resolves this item
- "update" - Item should be updated (e.g., new why_now, changed tier)
- "combine" - Item should be merged into another item (specify which)

For NEW items (actions that don't match existing items):
- Assign appropriate tier (1-5, lower = more urgent)
- Provide tier_trigger explaining why this tier
- Include why_now with specific context from the interaction
- Assign owner based on who should take action

TIER GUIDELINES:
- Tier 1: Immediate action required (same day) - customer waiting, urgent issue
- Tier 2: High priority (within 24-48 hours) - time-sensitive opportunity
- Tier 3: Standard follow-up (within a week) - scheduled callbacks, proposals
- Tier 4: Low priority (within 2 weeks) - relationship maintenance
- Tier 5: Backlog (no specific timeline) - future opportunities, nurture

Respond with JSON matching the schema.`;

const ACTION_RECONCILIATION_SCHEMA = `{
  "reasoning": "string - Brief explanation of your reconciliation logic",
  "existing_items": [
    {
      "id": "string - The existing item ID",
      "decision": "keep|complete|update|combine",
      "reason": "string - Why this decision",
      "updates": {
        "tier": "number - New tier if updating",
        "why_now": "string - New why_now if updating"
      },
      "combine_into": "string - ID of item to combine into, if combining"
    }
  ],
  "new_items": [
    {
      "title": "string - Action title",
      "description": "string - What needs to be done",
      "tier": "number 1-5",
      "tier_trigger": "string - Why this tier",
      "why_now": "string - Specific urgency from interaction",
      "owner": "string - rep|customer|system",
      "urgency": "string - immediate|high|standard|low"
    }
  ],
  "summary": "string - One sentence summary of reconciliation result"
}`;

const INTELLIGENCE_SYNTHESIS_PROMPT = `{{intelligenceContext}}

---

You are an expert sales intelligence analyst for X-RAI, a company selling phone systems and AI solutions to pest control and lawn care companies.

Analyze this intelligence data about "{{companyName}}" and provide a comprehensive sales intelligence report.

Consider:
1. What can we learn about this company's size, maturity, and operations?
2. What pain points might they have that our solutions could address?
3. What are the best opportunities to approach them?
4. Who are the key decision makers we should target?
5. What talking points would resonate with them?
6. What is the overall readiness of this account for sales engagement?
7. What are the top 5 prioritized recommendations for engaging this prospect?
8. What connection points can we use to build rapport (shared interests, community involvement, background)?
9. What objections might they raise and how should we respond?
10. What competitive signals or current providers can we identify?

IMPORTANT GUIDELINES:
- Provide exactly 5 recommendations, prioritized 1-5 (1 = highest priority)
- For recommendations, include specific talking points or scripts in the "action" field
- Find at least 2-3 connection points for rapport building (community involvement, hobbies, background)
- Anticipate 3-5 likely objections based on company profile
- Create a chronological signals timeline from all dated events found
- Be specific and reference actual data from the intelligence report
- Focus on insights that help close a sale

ADDITIONAL DEEP ANALYSIS:
- Assess company size tier based on employee indicators, job postings, and locations
- Extract pain points from Google review quotes - use actual customer words
- Evaluate marketing maturity and recommend approach accordingly
- Identify visible employees for relationship-building opportunities
- List all products/services with primary designations
- Include all service areas and certifications found

Respond with JSON matching the schema.`;

const INTELLIGENCE_SYNTHESIS_SCHEMA = `{
  "executiveSummary": "string - 2-3 paragraph executive overview",
  "painPoints": [{"pain": "string", "evidence": "string", "severity": "high|medium|low", "source": "string"}],
  "opportunities": [{"opportunity": "string", "approach": "string", "confidence": "high|medium|low", "source": "string"}],
  "talkingPoints": [{"topic": "string", "angle": "string", "source": "string", "useCase": "string"}],
  "recommendedApproach": "string - 1-2 paragraphs on best sales approach",
  "scores": {"overall": "0-100", "website": "0-100", "social": "0-100", "review": "0-100", "industry": "0-100"},
  "confidence": "0-1",
  "recommendations": [{"title": "string", "description": "string", "action": "string", "priority": "1-5", "confidence": "high|medium|low", "category": "string", "source": "string"}],
  "connectionPoints": [{"type": "string", "point": "string", "context": "string", "useCase": "string", "source": "string"}],
  "objectionPrep": [{"objection": "string", "likelihood": "high|medium|low", "response": "string", "evidence": "string", "source": "string"}],
  "signalsTimeline": [{"date": "string", "type": "string", "title": "string", "description": "string", "sentiment": "string", "source": "string", "url": "string"}],
  "competitiveIntel": {"currentProviders": [], "switchingSignals": [], "competitorMentions": []},
  "companyProfile": {"sizeTier": "string", "employeeEstimate": "number|null", "operationalMaturity": "string", "serviceModel": "string", "techAdoption": "string", "yearsInBusiness": "number|null"},
  "reviewPainPoints": [{"category": "string", "severity": "high|medium|low", "frequency": "number", "quotes": [], "implication": "string"}],
  "marketingProfile": {"maturityLevel": "string", "primaryChannels": [], "contentStrategy": "string", "digitalPresence": "0-100", "recommendation": "string"},
  "visibleEmployees": [{"name": "string", "title": "string", "visibilityScore": "0-100", "mediaAppearances": "number", "linkedinActive": "boolean", "connectionOpportunity": "string"}],
  "productsServices": [{"name": "string", "description": "string", "isPrimary": "boolean"}],
  "serviceAreas": ["string array"],
  "certifications": ["string array"]
}`;

const prompts = [
  {
    key: 'context_enrichment',
    name: 'Context Enrichment',
    description: 'Enriches command center action items with contextual why-now reasoning and optional email drafts',
    prompt_template: CONTEXT_ENRICHMENT_PROMPT,
    schema_template: CONTEXT_ENRICHMENT_SCHEMA,
    default_prompt_template: CONTEXT_ENRICHMENT_PROMPT,
    default_schema_template: CONTEXT_ENRICHMENT_SCHEMA,
    is_active: true,
    version: 1,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    category: 'command_center',
    purpose: 'Enriches action items with contextual why-now reasoning',
    variables: ['actionType', 'title', 'targetName', 'companyName', 'dealSnapshot', 'weightedValue', 'daysSinceResponse', 'recentEmails', 'transcriptContext', 'engagementContext', 'recentActivities', 'includeEmail'],
    provider: 'anthropic',
  },
  {
    key: 'action_reconciliation',
    name: 'Action Reconciliation',
    description: 'Reconciles new actions from interactions against existing command center items to avoid duplicates and maintain accurate work queue',
    prompt_template: ACTION_RECONCILIATION_PROMPT,
    schema_template: ACTION_RECONCILIATION_SCHEMA,
    default_prompt_template: ACTION_RECONCILIATION_PROMPT,
    default_schema_template: ACTION_RECONCILIATION_SCHEMA,
    is_active: true,
    version: 1,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    category: 'intelligence',
    purpose: 'Reconciles new actions against existing command center items',
    variables: ['salesPlaybook', 'interactionType', 'interactionDate', 'interactionSummary', 'communicationType', 'salesStage', 'requiredActions', 'existingItems', 'relationshipContext', 'today'],
    provider: 'anthropic',
  },
  {
    key: 'intelligence_synthesis',
    name: 'Intelligence Synthesis',
    description: 'Synthesizes account intelligence from multiple sources (website, reviews, LinkedIn, etc.) into actionable sales insights',
    prompt_template: INTELLIGENCE_SYNTHESIS_PROMPT,
    schema_template: INTELLIGENCE_SYNTHESIS_SCHEMA,
    default_prompt_template: INTELLIGENCE_SYNTHESIS_PROMPT,
    default_schema_template: INTELLIGENCE_SYNTHESIS_SCHEMA,
    is_active: true,
    version: 1,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    category: 'intelligence',
    purpose: 'Synthesizes account intelligence into actionable sales insights',
    variables: ['companyName', 'intelligenceContext'],
    provider: 'anthropic',
  },
];

async function createPrompts() {
  console.log('Creating managed prompts...\n');

  for (const prompt of prompts) {
    console.log(`Creating prompt: ${prompt.key}`);

    // Check if prompt already exists
    const { data: existing } = await supabase
      .from('ai_prompts')
      .select('id, key')
      .eq('key', prompt.key)
      .single();

    if (existing) {
      console.log(`  ⚠️  Prompt "${prompt.key}" already exists (id: ${existing.id}), updating...`);

      const { error } = await supabase
        .from('ai_prompts')
        .update({
          name: prompt.name,
          description: prompt.description,
          prompt_template: prompt.prompt_template,
          schema_template: prompt.schema_template,
          default_prompt_template: prompt.default_prompt_template,
          default_schema_template: prompt.default_schema_template,
          is_active: prompt.is_active,
          model: prompt.model,
          max_tokens: prompt.max_tokens,
          category: prompt.category,
          purpose: prompt.purpose,
          variables: prompt.variables,
          provider: prompt.provider,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`  ❌ Error updating ${prompt.key}:`, error.message);
      } else {
        console.log(`  ✅ Updated "${prompt.key}"`);
      }
    } else {
      const { data, error } = await supabase
        .from('ai_prompts')
        .insert(prompt)
        .select('id, key')
        .single();

      if (error) {
        console.error(`  ❌ Error creating ${prompt.key}:`, error.message);
      } else {
        console.log(`  ✅ Created "${prompt.key}" (id: ${data.id})`);
      }
    }
  }

  console.log('\nDone!');
}

createPrompts().catch(console.error);
