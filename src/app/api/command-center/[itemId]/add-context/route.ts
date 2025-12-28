/**
 * Add Context to Command Center Item
 *
 * POST /api/command-center/[itemId]/add-context
 *
 * Allows salespeople to add context that AI couldn't detect:
 * - "I ran into him at a conference, he's definitely buying"
 * - "She mentioned they're also talking to Gong"
 * - "Budget is approved, just needs CEO signature"
 *
 * If reanalyze=true, reruns the email analysis with the new context.
 *
 * TODO: Migrate reanalysis to use processIncomingCommunication from contextFirstPipeline
 * The full pipeline handles entity matching, context loading, analysis, and updates in one call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { addRelationshipNote } from '@/lib/intelligence/relationshipStore';
// Migrated to context-first pipeline
import { buildFullRelationshipContext } from '@/lib/intelligence';
import { callAIJson } from '@/lib/ai/core/aiClient';
import type { InboundEmailAnalysis } from '@/lib/intelligence/types';

// Helper to get internal user ID from auth user
async function getInternalUserId(authUserId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUserId)
    .single();
  return dbUser?.id || null;
}

interface AddContextRequest {
  context: string;
  contextType?: 'strategy' | 'insight' | 'warning' | 'general';
  reanalyze?: boolean;
}

// ============================================
// POST - Add context and optionally reanalyze
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { itemId } = await params;
    const body: AddContextRequest = await request.json();

    if (!body.context || body.context.trim().length === 0) {
      return NextResponse.json({ error: 'Context is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get the command center item
    const { data: item, error: itemError } = await supabase
      .from('command_center_items')
      .select('*, contact:contacts(id, name, email), company:companies(id, name)')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Get contact_id and company_id
    const contactId = item.contact_id || null;
    const companyId = item.company_id || null;

    if (!contactId && !companyId) {
      return NextResponse.json(
        { error: 'Item has no linked contact or company' },
        { status: 400 }
      );
    }

    // Save the note to relationship_notes
    const note = await addRelationshipNote({
      contactId: contactId || undefined,
      companyId: companyId || undefined,
      note: body.context,
      contextType: body.contextType || 'insight',
      addedBy: userId,
      linkedItemId: itemId,
      linkedSourceType: item.source,
      linkedSourceId: item.source_id || undefined,
    });

    console.log(`[AddContext] Saved note ${note.id} for item ${itemId}`);

    let reanalyzed = false;
    let newAnalysis: InboundEmailAnalysis | null = null;

    // If reanalyze requested and we have a source email
    if (body.reanalyze && item.source === 'email_sync' && item.source_id) {
      console.log(`[AddContext] Reanalyzing with context: "${body.context}"`);

      // Get the source email
      const { data: email } = await supabase
        .from('email_messages')
        .select('*')
        .eq('id', item.source_id)
        .single();

      if (email && !email.is_sent_by_user) {
        // Build fresh relationship context (now includes the new note)
        const relationshipContext = await buildFullRelationshipContext({
          contactId: contactId || undefined,
          companyId: companyId || undefined,
        });

        // Re-run analysis with special context section
        newAnalysis = await reanalyzeWithContext(
          email,
          { promptContext: relationshipContext.formattedForAI },
          body.context
        );

        if (newAnalysis) {
          reanalyzed = true;

          // Update the command center item with new analysis
          const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            reanalyzed_at: new Date().toISOString(),
            reanalyzed_with_context: body.context,
          };

          // Update tier if changed based on analysis
          const newTier = newAnalysis.command_center_classification?.tier;
          if (newTier && newTier !== item.tier) {
            updateData.tier = newTier;
            updateData.tier_trigger = newAnalysis.command_center_classification.tier_trigger;
            updateData.sla_minutes = newAnalysis.command_center_classification.sla_minutes;
          }

          // Update why_now
          if (newAnalysis.command_center_classification?.why_now) {
            updateData.why_now = newAnalysis.command_center_classification.why_now;
          }

          // Update context fields
          if (newAnalysis.full_analysis) {
            updateData.context_brief = newAnalysis.full_analysis.substring(0, 500);
          }

          // Store suggested actions
          if (newAnalysis.suggested_actions && newAnalysis.suggested_actions.length > 0) {
            updateData.suggested_actions = newAnalysis.suggested_actions;
          }

          // Store email draft
          if (newAnalysis.response_draft) {
            updateData.email_draft = newAnalysis.response_draft;
          }

          await supabase
            .from('command_center_items')
            .update(updateData)
            .eq('id', itemId);

          // Also update the email_messages record
          await supabase
            .from('email_messages')
            .update({
              ai_analysis: newAnalysis,
              analysis_complete: true,
            })
            .eq('id', item.source_id);

          console.log(`[AddContext] Reanalysis complete. New tier: ${newTier}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      noteId: note.id,
      reanalyzed,
      newAnalysis: reanalyzed ? {
        tier: newAnalysis?.command_center_classification?.tier,
        tier_trigger: newAnalysis?.command_center_classification?.tier_trigger,
        why_now: newAnalysis?.command_center_classification?.why_now,
        sentiment: newAnalysis?.sentiment,
        urgency: newAnalysis?.urgency,
        suggested_actions: newAnalysis?.suggested_actions,
        response_draft: newAnalysis?.response_draft,
      } : null,
    });
  } catch (error) {
    console.error('[AddContext] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// REANALYSIS WITH CONTEXT
// ============================================

interface EmailRecord {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  body_preview: string | null;
  received_at: string | null;
  sent_at: string | null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEmailBodyText(email: EmailRecord): string {
  if (email.body_text) return email.body_text;
  if (email.body_html) return stripHtml(email.body_html);
  return email.body_preview || '(no content)';
}

async function reanalyzeWithContext(
  email: EmailRecord,
  relationshipContext: { promptContext: string },
  salesContext: string
): Promise<InboundEmailAnalysis | null> {
  const emailBody = getEmailBodyText(email);
  const today = new Date().toISOString().split('T')[0];

  // Build prompt with special context section
  const prompt = `You are analyzing an inbound email. Use the full relationship history to understand who this person is and what they're really asking.

${relationshipContext.promptContext}

## IMPORTANT: SALESPERSON JUST ADDED THIS CONTEXT

The salesperson added this note to help with analysis. Factor it heavily into
your response - they know something the data doesn't show:

"${salesContext}"

---

## NEW EMAIL TO ANALYZE

From: ${email.from_name || ''} <${email.from_email}>
Subject: ${email.subject || '(no subject)'}
Date: ${email.received_at || email.sent_at || 'Unknown'}

${emailBody}

---

Analyze this email IN CONTEXT of the relationship AND the salesperson's note above.

The salesperson's context is CRITICAL - use it to:
1. Adjust the tier/urgency if their insight reveals competitive pressure or timing
2. Incorporate their knowledge into the response draft
3. Update the "why_now" to reflect what they know

Return JSON:
{
  "summary": "One sentence summary",

  "full_analysis": "2-3 paragraphs - incorporate the salesperson's context",

  "request_type": "demo_request" | "pricing_question" | "general_question" | "meeting_request" | "follow_up" | "objection" | "positive_response" | "info_share" | "introduction" | "complaint" | "other",

  "key_questions": ["Specific questions they asked"],

  "context_connections": [
    {
      "connection": "How this relates to a prior interaction or the salesperson's note",
      "prior_date": "2024-12-04",
      "relevance": "Why this matters"
    }
  ],

  "key_facts_learned": ["New facts, including from salesperson's context"],

  "commitment_updates": {
    "fulfilled_theirs": [],
    "new_theirs": [{"commitment": "string", "expected_by": "date or null"}]
  },

  "signal_updates": {
    "new_buying_signals": [{"signal": "string", "quote": "string", "strength": "strong|moderate|weak"}],
    "new_concerns": [{"concern": "string", "severity": "high|medium|low"}],
    "resolved_concerns": []
  },

  "sentiment": "Very Positive" | "Positive" | "Neutral" | "Concerned" | "Frustrated" | "Negative",
  "urgency": "High" | "Medium" | "Low",

  "relationship_progression": {
    "momentum": "accelerating" | "steady" | "stalling" | "at_risk",
    "assessment": "One sentence on where this relationship stands now"
  },

  "suggested_actions": [
    {
      "action": "What to do",
      "priority": "high" | "medium" | "low",
      "reasoning": "Why, given the salesperson's context"
    }
  ],

  "response_draft": {
    "subject": "Re: ${email.subject || ''}",
    "body": "Full draft response. Use the salesperson's insight to personalize."
  },

  "command_center_classification": {
    "tier": 1 | 2 | 3 | 4 | 5,
    "tier_trigger": "demo_request" | "pricing_request" | "email_reply" | "hot_lead" | "commitment" | "competitive_risk" | "deadline_approaching" | "general",
    "sla_minutes": 15 | 120 | 240 | 480,
    "why_now": "One sentence explaining urgency - incorporate the salesperson's context"
  }
}

IMPORTANT TIER GUIDANCE:
- If salesperson mentions competition (Gong, etc.) -> Tier 2 (competitive_risk)
- If salesperson mentions deadline/timing pressure -> Tier 2 (deadline_approaching)
- If salesperson confirms budget/decision maker buy-in -> likely Tier 1 or 2
- Adjust tier based on the new information, not just the email content

Today's date is ${today}.`;

  const schema = `{
  "summary": "string",
  "full_analysis": "string",
  "request_type": "string",
  "key_questions": ["string"],
  "context_connections": [{"connection": "string", "prior_date": "string|null", "relevance": "string"}],
  "key_facts_learned": ["string"],
  "commitment_updates": {
    "fulfilled_theirs": ["string"],
    "new_theirs": [{"commitment": "string", "expected_by": "string|null"}]
  },
  "signal_updates": {
    "new_buying_signals": [{"signal": "string", "quote": "string", "strength": "strong|moderate|weak"}],
    "new_concerns": [{"concern": "string", "severity": "high|medium|low"}],
    "resolved_concerns": ["string"]
  },
  "sentiment": "string",
  "urgency": "string",
  "relationship_progression": {"momentum": "string", "assessment": "string"},
  "suggested_actions": [{"action": "string", "priority": "high|medium|low", "reasoning": "string"}],
  "response_draft": {"subject": "string", "body": "string"},
  "command_center_classification": {"tier": "number", "tier_trigger": "string", "sla_minutes": "number", "why_now": "string"}
}`;

  try {
    const result = await callAIJson<InboundEmailAnalysis>({
      prompt,
      schema,
      maxTokens: 3000,
    });
    return result.data;
  } catch (error) {
    console.error('[AddContext] Reanalysis failed:', error);
    return null;
  }
}
