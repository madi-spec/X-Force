/**
 * Run the summary prompts migration directly against Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.error('Failed to load .env.local:', e.message);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running summary prompts migration...\n');

  // Check if prompts already exist
  const { data: existing } = await supabase
    .from('ai_prompts')
    .select('key')
    .in('key', ['deal_summary', 'company_summary', 'contact_summary']);

  if (existing && existing.length > 0) {
    console.log('Some prompts already exist:', existing.map(p => p.key).join(', '));
    console.log('Skipping those and inserting only new ones...\n');
  }

  const existingKeys = new Set(existing?.map(p => p.key) || []);

  // Define the prompts
  const prompts = [
    {
      key: 'deal_summary',
      name: 'Deal Summary',
      description: 'Generates AI-powered summaries for deals, including status analysis, stakeholder insights, risks, opportunities, and recommended actions.',
      prompt_template: `Generate a comprehensive summary for this sales deal.

{{dealInfo}}

{{companyInfo}}

{{contactsInfo}}

{{activitiesInfo}}

{{tasksInfo}}

{{metricsInfo}}

---

Analyze this deal and provide a comprehensive JSON summary. Be specific and actionable. Reference actual data from the context. Don't be generic.

Focus on:
- Current deal health and trajectory
- Key stakeholder relationships and sentiment
- Engagement patterns and communication frequency
- Risk factors that could derail the deal
- Opportunities to accelerate or expand the deal
- Concrete next steps with clear reasoning

Important guidelines:
- The headline should capture the deal's current momentum and key challenge/opportunity
- The overview should tell the story of this deal - where it started, where it is, what's needed to close
- Key points should be specific observations, not generic statements
- Risks should be based on actual signals (lack of engagement, missing stakeholders, stalled stage, etc.)
- Recommended actions should be specific and actionable with clear reasoning`,
      schema_template: `{
  "headline": "One compelling sentence summarizing the deal's current state and momentum",
  "overview": "2-3 paragraphs providing context on the deal, its history, current status, and what's needed to close it",
  "currentStatus": {
    "stage": "Current stage name",
    "daysInStage": 0,
    "healthScore": 0-100,
    "trend": "improving|stable|declining"
  },
  "keyPoints": [
    {"point": "Important observation about the deal", "importance": "high|medium|low"}
  ],
  "stakeholderStatus": {
    "totalContacts": 0,
    "hasDecisionMaker": true|false,
    "hasChampion": true|false,
    "keyPlayers": [
      {"name": "Contact name", "role": "Their role", "sentiment": "positive|neutral|negative|unknown"}
    ]
  },
  "engagement": {
    "lastContactDate": "ISO date or null",
    "daysSinceContact": 0,
    "recentActivityCount": 0,
    "communicationPattern": "Description of how communication has been going"
  },
  "risks": ["List of risks or concerns about this deal"],
  "opportunities": ["List of opportunities or positive indicators"],
  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "high|medium|low",
      "reasoning": "Why this action is recommended"
    }
  ],
  "confidence": 0.0-1.0
}`,
    },
    {
      key: 'company_summary',
      name: 'Company Summary',
      description: 'Generates AI-powered summaries for companies, including relationship status, product usage, engagement analysis, expansion opportunities, and churn risks.',
      prompt_template: `Generate a comprehensive summary for this company.

{{companyInfo}}

{{productsInfo}}

{{contactsInfo}}

{{dealsInfo}}

{{engagementInfo}}

{{activitiesInfo}}

---

Analyze this company and provide a comprehensive JSON summary. Be specific. Reference actual data. Focus on actionable insights.

Focus on:
- Overall relationship health and trajectory
- Product adoption and expansion opportunities
- Key contact relationships and engagement
- Revenue trends and growth potential
- Churn risk factors
- Strategic recommendations for account growth

Important guidelines:
- The headline should capture the essence of this customer/prospect relationship
- The overview should tell the story of this company - how they became a customer, their journey, current state
- Opportunities should be specific upsell/cross-sell possibilities based on their profile
- Risks should flag any concerning patterns (declining engagement, support issues, etc.)
- Recommended actions should be prioritized and specific`,
      schema_template: `{
  "headline": "One compelling sentence summarizing the company relationship",
  "overview": "2-3 paragraphs about the company, relationship history, and current state",
  "profile": {
    "status": "cold_lead|prospect|customer|churned",
    "segment": "smb|mid_market|enterprise|pe_platform|franchisor",
    "industry": "pest|lawn|both",
    "size": "X agents",
    "crmPlatform": "Platform name or null",
    "isVoiceCustomer": true|false
  },
  "relationship": {
    "tenure": "X months/years or null",
    "currentProducts": ["List of active products"],
    "totalRevenue": "annual revenue number or null",
    "healthStatus": "healthy|at_risk|churned|prospect"
  },
  "keyContacts": [
    {
      "name": "Contact name",
      "title": "Title or null",
      "role": "Role or null",
      "isPrimary": true|false
    }
  ],
  "dealsSummary": {
    "activeDeals": 0,
    "totalPipelineValue": 0,
    "closedWonValue": 0,
    "dealStages": {"stage_name": "count"}
  },
  "engagement": {
    "totalActivities": 0,
    "lastActivityDate": "ISO date or null",
    "activityTrend": "increasing|stable|decreasing",
    "primaryChannels": ["email", "meeting", "call"]
  },
  "opportunities": ["List expansion or upsell opportunities"],
  "risks": ["List any concerns or churn risks"],
  "recommendedActions": [
    {
      "action": "Specific next step",
      "priority": "high|medium|low",
      "reasoning": "Why this action"
    }
  ],
  "confidence": 0.0-1.0
}`,
    },
    {
      key: 'contact_summary',
      name: 'Contact Summary',
      description: 'Generates AI-powered summaries for contacts, including influence analysis, communication preferences, engagement patterns, and relationship building tips.',
      prompt_template: `Generate a comprehensive summary for this contact person.

{{contactInfo}}

{{companyInfo}}

{{dealsInfo}}

{{engagementInfo}}

{{communicationsInfo}}

---

Analyze this contact and provide a comprehensive JSON summary. Be specific. Infer from the communication patterns and content. Focus on actionable insights for sales.

Focus on:
- Role and influence in buying decisions
- Communication style and preferences
- Engagement level and responsiveness
- Key interests and pain points mentioned
- Relationship strength and sentiment
- Tips for building rapport

Important guidelines:
- The headline should capture this person's role and relationship status
- The overview should describe who this person is, their importance, and engagement history
- Influence assessment should be based on actual signals (title, involvement in meetings, decision-making mentions)
- Pain points and interests should come from actual conversation content
- Relationship tips should be specific and actionable`,
      schema_template: `{
  "headline": "One sentence capturing this person's role and relationship status",
  "overview": "2-3 paragraphs about this contact, their role, engagement history, and relationship",
  "profile": {
    "name": "Full name",
    "title": "Job title or null",
    "role": "CRM role or null",
    "company": "Company name",
    "email": "Email or null",
    "phone": "Phone or null"
  },
  "influence": {
    "decisionMakingRole": "decision_maker|influencer|champion|end_user|blocker|unknown",
    "buyingInfluence": "high|medium|low",
    "sentiment": "positive|neutral|negative|unknown",
    "engagementLevel": "highly_engaged|engaged|passive|disengaged"
  },
  "communication": {
    "preferredChannel": "email|phone|meeting|unknown",
    "responsePattern": "Description of how they typically respond",
    "bestTimeToReach": "Inferred best time or null"
  },
  "engagement": {
    "totalInteractions": 0,
    "lastContactDate": "ISO date or null",
    "daysSinceContact": 0,
    "interactionTypes": {"type": "count"}
  },
  "keyInsights": [
    {"insight": "Important observation about this contact", "source": "Where this was learned"}
  ],
  "painPoints": ["Pain points this person has mentioned or shown"],
  "interests": ["Topics or areas they've shown interest in"],
  "relationshipTips": ["Tips for building relationship with this contact"],
  "confidence": 0.0-1.0
}`,
    },
  ];

  // Insert prompts that don't already exist
  for (const prompt of prompts) {
    if (existingKeys.has(prompt.key)) {
      console.log(`✓ ${prompt.name} already exists, skipping`);
      continue;
    }

    const { error } = await supabase.from('ai_prompts').insert({
      key: prompt.key,
      name: prompt.name,
      description: prompt.description,
      prompt_template: prompt.prompt_template,
      schema_template: prompt.schema_template,
      default_prompt_template: prompt.prompt_template,
      default_schema_template: prompt.schema_template,
      is_active: true,
      version: 1,
    });

    if (error) {
      console.error(`✗ Failed to insert ${prompt.name}:`, error.message);
    } else {
      console.log(`✓ Inserted ${prompt.name}`);
    }
  }

  console.log('\nMigration complete!');
}

runMigration().catch(console.error);
