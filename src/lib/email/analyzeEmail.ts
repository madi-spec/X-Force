/**
 * Email AI Analysis
 *
 * Deep AI analysis for inbound emails, matching transcript intelligence quality.
 * Uses enriched context to detect buying signals, concerns, and generate responses.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  enrichEmailContext,
  getEmailById,
  type EmailContext,
  type InboundEmail,
} from './enrichEmailContext';
import { cleanEmailContent } from './contentCleaner';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// TYPES
// ============================================

export interface EmailAnalysisResult {
  email_analysis: {
    request_type: 'demo_request' | 'pricing_question' | 'general_question' | 'meeting_request' | 'follow_up' | 'complaint' | 'info_share' | 'introduction' | 'other';
    summary: string;
    full_understanding: string;
    key_questions: string[];
    urgency: 'High' | 'Medium' | 'Low';
    sentiment: 'Very Positive' | 'Positive' | 'Neutral' | 'Concerned' | 'Frustrated' | 'Negative';
    tone: string;
  };
  buying_signals: Array<{
    signal: string;
    quote: string;
    strength: 'strong' | 'moderate' | 'weak';
    implication: string;
  }>;
  concerns_detected: Array<{
    concern: string;
    quote: string;
    severity: 'high' | 'medium' | 'low';
    suggested_response: string;
  }>;
  suggested_actions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;
  response_draft: {
    subject: string;
    body: string;
  };
  command_center_classification: {
    tier: 1 | 2 | 3 | 4 | 5;
    tier_trigger: string;
    sla_minutes: number;
    why_now: string;
  };
}

export interface AnalyzeEmailResult {
  email: InboundEmail;
  context: EmailContext;
  analysis: EmailAnalysisResult;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
}

// ============================================
// PROMPT BUILDER
// ============================================

function buildPrompt(email: InboundEmail, context: EmailContext): string {
  // Format interaction history
  const interactionHistory = context.history.length > 0
    ? context.history.map(h => {
        const daysAgo = Math.floor((Date.now() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24));
        return `- [${h.type}] ${daysAgo}d ago: ${h.summary.substring(0, 100)}`;
      }).join('\n')
    : 'No prior interactions recorded.';

  // Format meeting summaries
  const meetingSummaries = context.recentMeetings.length > 0
    ? context.recentMeetings.map(m => {
        let meetingInfo = `### ${m.title} (${m.date})\n`;
        if (m.summary) meetingInfo += `Summary: ${m.summary}\n`;
        if (m.buying_signals.length > 0) {
          meetingInfo += `Buying Signals: ${m.buying_signals.join(', ')}\n`;
        }
        if (m.commitments.length > 0) {
          meetingInfo += `Commitments: ${m.commitments.join('; ')}\n`;
        }
        return meetingInfo;
      }).join('\n')
    : 'No recent meetings.';

  // Format thread context
  const threadContext = context.threadEmails.length > 0
    ? context.threadEmails.map(t => {
        const dir = t.direction === 'outbound' ? '[SENT]' : '[RECV]';
        return `${dir} ${t.from_name || 'Unknown'}: ${t.body_preview?.substring(0, 150) || '(empty)'}`;
      }).join('\n---\n')
    : 'This is a new conversation thread.';

  // Format relationship intelligence
  const ri = context.relationshipIntel;

  const salespersonNotes = ri.notes.length > 0
    ? ri.notes.map(n => `- [${n.context_type.toUpperCase()}] ${n.note}`).join('\n')
    : 'No salesperson notes.';

  const knownBuyingSignals = ri.buyingSignals.length > 0
    ? ri.buyingSignals.map(s => `- [${s.strength}] ${s.signal}${s.quote ? ` ("${s.quote}")` : ''}`).join('\n')
    : 'None detected yet.';

  const knownConcerns = ri.concerns.filter(c => !c.resolved).length > 0
    ? ri.concerns.filter(c => !c.resolved).map(c => `- [${c.severity}] ${c.concern}`).join('\n')
    : 'None detected.';

  const openCommitments = [
    ...ri.ourCommitments.map(c => `- [OURS] ${c.commitment}${c.due_by ? ` (due: ${c.due_by})` : ''}`),
    ...ri.theirCommitments.map(c => `- [THEIRS] ${c.commitment}${c.expected_by ? ` (expected: ${c.expected_by})` : ''}`),
  ].join('\n') || 'None outstanding.';

  const keyFacts = ri.keyFacts.length > 0
    ? ri.keyFacts.map(f => `- ${f}`).join('\n')
    : 'None recorded.';

  // Get email body (prefer text, fall back to preview) and clean boilerplate
  const rawBody = email.body_text || email.body_preview || '(No body content)';
  const emailBody = cleanEmailContent(rawBody);

  return `You are analyzing an inbound email for a sales team. Your job is to understand:
1. Who is this person and what's our relationship?
2. What are they asking for or telling us?
3. What buying signals or concerns are present?
4. What should we do next?
5. Draft a response if appropriate.

Be specific - reference actual data from the context. Never be generic.

## CONTEXT ABOUT THE SENDER

<sender>
Name: ${context.contact?.name || email.from_name || 'Unknown'}
Email: ${email.from_email}
Title: ${context.contact?.title || 'Unknown'}
Company: ${context.company?.name || 'Unknown'}
Industry: ${context.company?.industry || 'Unknown'}
Company Segment: ${context.company?.segment || 'Unknown'}
</sender>

<relationship>
Stage: ${context.relationshipStage}
Last Contact: ${context.lastContactDays !== null ? `${context.lastContactDays} days ago` : 'Unknown'}
Total Interactions: ${context.totalInteractions}
</relationship>

<active_deal>
Deal Name: ${context.deal?.name || 'No active deal'}
Value: ${context.deal?.estimated_value ? `$${context.deal.estimated_value.toLocaleString()}` : 'Unknown'}
Stage: ${context.deal?.stage || 'N/A'}
</active_deal>

${ri.summary ? `<relationship_summary>\n${ri.summary}\n</relationship_summary>\n` : ''}
<salesperson_notes>
${salespersonNotes}
</salesperson_notes>

<known_buying_signals>
${knownBuyingSignals}
</known_buying_signals>

<known_concerns>
${knownConcerns}
</known_concerns>

<open_commitments>
${openCommitments}
</open_commitments>

<key_facts_about_them>
${keyFacts}
</key_facts_about_them>

<recent_interactions>
${interactionHistory}
</recent_interactions>

<recent_meeting_context>
${meetingSummaries}
</recent_meeting_context>

<email_thread>
${threadContext}
</email_thread>

## THE NEW EMAIL TO ANALYZE

Subject: ${email.subject || '(No subject)'}
Date: ${email.received_at}

${emailBody}

---

Analyze this email and return JSON with this exact structure:

{
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
    "tier_trigger": "demo_request | pricing_request | trial_request | email_reply | meeting_request | inbound_lead | objection | competitor | meeting_commitment | follow_up | general",
    "sla_minutes": 120,
    "why_now": "One compelling sentence"
  }
}

Important guidelines:
- Be specific and reference actual data from the context
- For buying_signals and concerns_detected, quote directly from the email when possible
- The response_draft should be professional, warm, and reference specific context
- For command_center_classification, use EXACTLY these tier_trigger values:
  - Tier 1 (RESPOND NOW): demo_request, pricing_request, trial_request, email_reply, meeting_request, inbound_lead, direct_question
  - Tier 2 (DON'T LOSE THIS): objection, competitor, competitive_risk, deadline_critical, urgency_signal, buying_signal
  - Tier 3 (KEEP YOUR WORD): meeting_commitment, follow_up, deliverable_promised, action_item
  - Tier 4 (MOVE BIG DEALS): high_value, deal_stale (deal going quiet)
  - Tier 5 (BUILD PIPELINE): general, informational, nurture, research_needed
- If arrays are empty (no signals, no concerns), use empty arrays []

Respond ONLY with valid JSON, no markdown or extra text.`;
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function analyzeEmail(emailId: string): Promise<AnalyzeEmailResult> {
  const startTime = Date.now();

  // 1. Get the email
  const email = await getEmailById(emailId);
  if (!email) {
    throw new Error(`Email not found: ${emailId}`);
  }

  // Skip outbound emails
  if (email.is_sent_by_user) {
    throw new Error('Cannot analyze outbound emails - only inbound emails are supported');
  }

  // 2. Enrich context
  const context = await enrichEmailContext(email);

  // 3. Build prompt
  const prompt = buildPrompt(email, context);

  // 4. Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  });

  const latencyMs = Date.now() - startTime;

  // 5. Parse response
  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  let jsonText = textContent.text.trim();

  // Clean up markdown code blocks if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  }
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  let analysis: EmailAnalysisResult;
  try {
    analysis = JSON.parse(jsonText);
  } catch (parseError) {
    console.error('Failed to parse AI response:', jsonText);
    throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
  }

  return {
    email,
    context,
    analysis,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    latencyMs,
  };
}

// ============================================
// SAVE ANALYSIS TO DATABASE
// ============================================

export async function saveEmailAnalysis(result: AnalyzeEmailResult): Promise<void> {
  const supabase = createAdminClient();

  // Update email_messages with analysis
  await supabase
    .from('email_messages')
    .update({
      ai_analysis: result.analysis,
      analysis_complete: true,
    })
    .eq('id', result.email.id);
}

// ============================================
// BATCH ANALYSIS
// ============================================

export async function getUnanalyzedEmails(userId: string, limit: number = 10): Promise<string[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_messages')
    .select('id')
    .eq('user_id', userId)
    .eq('is_sent_by_user', false)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('received_at', { ascending: false })
    .limit(limit);

  return data?.map(e => e.id) || [];
}
