import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Onboarding-specific prompts
const prompts = [
  {
    key: 'transcript_analysis__onboarding',
    name: 'Transcript Analysis - Onboarding',
    description: 'Analyzes meeting transcripts for onboarding-specific insights: blockers, training gaps, go-live risks, and adoption signals.',
    prompt_template: `You are an expert customer onboarding analyst. Analyze this meeting transcript and extract actionable intelligence for successful implementation.

## Meeting Information
- Title: {{title}}
- Date: {{meetingDate}}
- Attendees: {{attendees}}
{{contextSection}}

## Transcription
{{transcription}}

---

Analyze this onboarding meeting and provide a comprehensive JSON response. Focus on:
1. Implementation blockers and their severity
2. Training gaps identified
3. Go-live checklist status
4. Customer and team commitments
5. Adoption indicators (positive and concerning)
6. Risks to successful implementation
7. Stakeholder sentiment
8. Timeline confidence

Be specific and actionable. Extract exact quotes where relevant.`,
    schema_template: JSON.stringify({
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence summary of the meeting" },
        blockers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              blocker: { type: "string" },
              severity: { type: "string", enum: ["critical", "moderate", "minor"] },
              owner: { type: "string", enum: ["us", "customer", "third_party"] },
              resolution_path: { type: "string" }
            },
            required: ["blocker", "severity", "owner", "resolution_path"]
          }
        },
        training_gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              area: { type: "string" },
              users_affected: { type: "string" },
              suggested_remedy: { type: "string" }
            },
            required: ["area", "users_affected", "suggested_remedy"]
          }
        },
        go_live_checklist: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              status: { type: "string", enum: ["complete", "in_progress", "not_started", "blocked"] },
              owner: { type: "string", enum: ["us", "customer"] },
              due_date: { type: "string" }
            },
            required: ["item", "status", "owner"]
          }
        },
        ourCommitments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              commitment: { type: "string" },
              due_date: { type: "string" },
              owner: { type: "string" }
            },
            required: ["commitment"]
          }
        },
        theirCommitments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              commitment: { type: "string" },
              due_date: { type: "string" },
              owner: { type: "string" }
            },
            required: ["commitment"]
          }
        },
        actionItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              owner: { type: "string" },
              due_date: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] }
            },
            required: ["description"]
          }
        },
        adoption_indicators: {
          type: "array",
          items: {
            type: "object",
            properties: {
              signal: { type: "string" },
              sentiment: { type: "string", enum: ["positive", "concerning"] },
              quote: { type: "string" }
            },
            required: ["signal", "sentiment"]
          }
        },
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              risk: { type: "string" },
              likelihood: { type: "string", enum: ["high", "medium", "low"] },
              impact: { type: "string", enum: ["high", "medium", "low"] },
              mitigation: { type: "string" }
            },
            required: ["risk", "likelihood", "impact"]
          }
        },
        stakeholder_sentiment: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              sentiment: { type: "string", enum: ["champion", "engaged", "neutral", "frustrated", "blocker"] },
              notes: { type: "string" }
            },
            required: ["name", "role", "sentiment", "notes"]
          }
        },
        go_live_date: { type: "string" },
        go_live_confidence: { type: "string", enum: ["on_track", "at_risk", "delayed"] },
        sentiment: { type: "string", enum: ["positive", "neutral", "negative"] }
      },
      required: ["summary", "blockers", "training_gaps", "go_live_checklist", "ourCommitments", "theirCommitments", "actionItems", "adoption_indicators", "risks", "stakeholder_sentiment", "go_live_confidence", "sentiment"]
    }, null, 2),
    category: 'transcript_analysis',
    purpose: 'Process-aware transcript analysis for onboarding meetings. Extracts implementation blockers, training gaps, go-live readiness, adoption signals, and stakeholder sentiment.',
    variables: ['title', 'meetingDate', 'attendees', 'contextSection', 'transcription'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
  },
  {
    key: 'meeting_prep__onboarding',
    name: 'Meeting Prep - Onboarding',
    description: 'Generates meeting preparation for onboarding meetings: implementation status, training agenda, blocker review.',
    prompt_template: `Generate meeting prep for an onboarding/implementation meeting:

MEETING: {{title}}
DATE/TIME: {{meetingTime}}

ATTENDEES:
{{attendeeList}}

{{relationshipContext}}

---

Generate prep focused on:
1. Implementation status check - what milestones to review
2. Training agenda - what topics need coverage
3. Blocker review - known issues to address
4. Go-live readiness - timeline and risks to discuss
5. Questions to ask - discovery about adoption and satisfaction

Be specific to onboarding context, not sales.`,
    schema_template: JSON.stringify({
      type: "object",
      properties: {
        objective: { type: "string", description: "Primary objective for this meeting" },
        implementation_status_items: {
          type: "array",
          items: { type: "string" },
          description: "Implementation milestones to review"
        },
        training_agenda: {
          type: "array",
          items: { type: "string" },
          description: "Training topics to cover"
        },
        blockers_to_review: {
          type: "array",
          items: { type: "string" },
          description: "Known blockers to address"
        },
        go_live_discussion_points: {
          type: "array",
          items: { type: "string" },
          description: "Go-live readiness discussion points"
        },
        questions_to_ask: {
          type: "array",
          items: { type: "string" },
          description: "Discovery questions about adoption and satisfaction"
        },
        landmines: {
          type: "array",
          items: { type: "string" },
          description: "Potential issues to be aware of"
        }
      },
      required: ["objective", "implementation_status_items", "training_agenda", "blockers_to_review", "go_live_discussion_points", "questions_to_ask"]
    }, null, 2),
    category: 'meeting_prep',
    purpose: 'Process-aware meeting prep for onboarding meetings. Focuses on implementation status, training agenda, blockers, and go-live readiness instead of sales objectives.',
    variables: ['title', 'meetingTime', 'attendeeList', 'relationshipContext'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
  },
  {
    key: 'email_followup__onboarding',
    name: 'Follow-up Email - Onboarding',
    description: 'Generates follow-up emails for onboarding/implementation contexts.',
    prompt_template: `Generate a follow-up email for an onboarding/implementation context.

CONTACT: {{contactName}}
COMPANY: {{companyName}}
CONTEXT: {{contextSummary}}

The email should:
1. Reference the current implementation status
2. Address any outstanding blockers or action items
3. Confirm next steps and timeline
4. Maintain supportive, helpful tone (not sales-y)

Generate a professional follow-up email.`,
    schema_template: JSON.stringify({
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content" },
        quality_checks: {
          type: "object",
          properties: {
            used_contact_name: { type: "boolean" },
            referenced_prior_interaction: { type: "boolean" }
          }
        }
      },
      required: ["subject", "body"]
    }, null, 2),
    category: 'email',
    purpose: 'Process-aware follow-up email generation for onboarding contexts. Emphasizes support and implementation progress rather than sales.',
    variables: ['contactName', 'companyName', 'contextSummary'],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
  },
];

async function run() {
  console.log('Adding onboarding-specific prompts to database...\n');

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
          schema_template: prompt.schema_template,
          default_schema_template: prompt.schema_template,
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
          schema_template: prompt.schema_template,
          default_schema_template: prompt.schema_template,
          category: prompt.category,
          purpose: prompt.purpose,
          variables: prompt.variables,
          model: prompt.model,
          max_tokens: prompt.max_tokens,
          is_active: true,
          version: 1,
          provider: 'anthropic',
        });

      if (error) {
        console.log(`  [ERROR] ${prompt.key}: ${error.message}`);
      } else {
        console.log(`  [ADDED] ${prompt.key}`);
      }
    }
  }

  // Verify prompts were added
  const { data: allOnboarding } = await supabase
    .from('ai_prompts')
    .select('key, name, category, is_active')
    .like('key', '%onboarding%');

  console.log('\nOnboarding prompts in database:');
  console.table(allOnboarding);

  console.log('\nDone!');
}

run().catch(console.error);
