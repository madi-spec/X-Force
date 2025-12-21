/**
 * Test Email AI Analysis
 *
 * Run with: npx tsx scripts/test-email-analysis.ts <email_id>
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================
// INLINE CONTEXT ENRICHMENT (from enrichEmailContext.ts)
// ============================================

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'live.com', 'msn.com', 'mail.com',
  'protonmail.com', 'zoho.com', 'ymail.com', 'comcast.net',
  'att.net', 'verizon.net', 'sbcglobal.net', 'cox.net', 'charter.net',
]);

const INTERNAL_DOMAINS = new Set([
  'xrailabsteam.com', 'xrailabs.com', 'affiliatedtech.com', 'x-rai.com',
]);

function extractDomain(email: string): string {
  return email.toLowerCase().split('@')[1] || '';
}

function isPersonalEmail(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase());
}

function isInternalEmail(domain: string): boolean {
  return INTERNAL_DOMAINS.has(domain.toLowerCase());
}

function domainToCompanyName(domain: string): string {
  return domain
    .replace(/\.(com|net|org|io|co|biz|us|info)$/, '')
    .split(/[-_.]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface MeetingAnalysis {
  keyPoints?: Array<{ topic: string }>;
  ourCommitments?: Array<{ commitment: string }>;
  theirCommitments?: Array<{ commitment: string }>;
  sentiment?: { overall: string };
  buyingSignals?: Array<{ signal: string }>;
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

async function analyzeEmail(emailId: string) {
  console.log('='.repeat(70));
  console.log('EMAIL DEEP AI ANALYSIS TEST');
  console.log('='.repeat(70));

  // 1. Get the email
  const { data: email, error: emailError } = await supabase
    .from('email_messages')
    .select(`
      id, user_id, conversation_ref, message_id,
      subject, from_email, from_name,
      body_text, body_preview, body_html,
      received_at, is_sent_by_user
    `)
    .eq('id', emailId)
    .single();

  if (emailError || !email) {
    console.error('Email not found:', emailError?.message);
    return;
  }

  if (email.is_sent_by_user) {
    console.error('Cannot analyze outbound emails - only inbound emails are supported');
    return;
  }

  console.log('\n📧 EMAIL:');
  console.log(`  From: ${email.from_name} <${email.from_email}>`);
  console.log(`  Subject: ${email.subject}`);
  console.log(`  Received: ${email.received_at}`);

  const domain = extractDomain(email.from_email);
  const emailLower = email.from_email.toLowerCase();

  // 2. Get context (simplified version of enrichEmailContext)
  let contact: { id: string; name: string | null; title: string | null; company_id: string | null } | null = null;
  let company: { id: string; name: string; industry: string | null; segment: string | null } | null = null;
  let deal: { id: string; name: string; stage: string; estimated_value: number | null } | null = null;

  // Find contact
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, title, company_id')
    .ilike('email', emailLower)
    .single();

  if (existingContact) {
    contact = existingContact;
  }

  // Find company
  if (!isPersonalEmail(domain) && !isInternalEmail(domain)) {
    if (contact?.company_id) {
      const { data: linkedCompany } = await supabase
        .from('companies')
        .select('id, name, industry, segment')
        .eq('id', contact.company_id)
        .single();
      if (linkedCompany) company = linkedCompany;
    }

    if (!company) {
      const { data: domainCompany } = await supabase
        .from('companies')
        .select('id, name, industry, segment')
        .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
        .single();
      if (domainCompany) company = domainCompany;
    }
  }

  // Find deal
  const companyId = contact?.company_id || company?.id;
  if (companyId) {
    const { data: activeDeal } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value')
      .eq('company_id', companyId)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (activeDeal) deal = activeDeal;
  }

  // Get thread context
  const { data: thread } = await supabase
    .from('email_messages')
    .select('id, is_sent_by_user, received_at, from_name, body_preview')
    .eq('conversation_ref', email.conversation_ref)
    .neq('id', email.id)
    .order('received_at', { ascending: false })
    .limit(5);

  // Get recent meetings
  let recentMeetings: Array<{ title: string; date: string; summary: string | null; analysis: MeetingAnalysis | null }> = [];
  const meetingFilters: string[] = [];
  if (contact?.id) meetingFilters.push(`contact_id.eq.${contact.id}`);
  if (company?.id) meetingFilters.push(`company_id.eq.${company.id}`);
  if (deal?.id) meetingFilters.push(`deal_id.eq.${deal.id}`);

  if (meetingFilters.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: meetings } = await supabase
      .from('meeting_transcriptions')
      .select('title, meeting_date, summary, analysis')
      .or(meetingFilters.join(','))
      .gte('meeting_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('meeting_date', { ascending: false })
      .limit(3);

    if (meetings) {
      recentMeetings = meetings.map(m => ({
        title: m.title,
        date: m.meeting_date,
        summary: m.summary,
        analysis: m.analysis as MeetingAnalysis | null,
      }));
    }
  }

  console.log('\n📊 CONTEXT GATHERED:');
  console.log(`  Contact: ${contact?.name || 'None'}`);
  console.log(`  Company: ${company?.name || 'None'}`);
  console.log(`  Deal: ${deal?.name || 'None'} ${deal ? `($${deal.estimated_value?.toLocaleString()}, ${deal.stage})` : ''}`);
  console.log(`  Thread: ${thread?.length || 0} prior messages`);
  console.log(`  Recent Meetings: ${recentMeetings.length}`);

  // 3. Build the prompt
  const threadContext = thread && thread.length > 0
    ? thread.map(t => {
        const dir = t.is_sent_by_user ? '[SENT]' : '[RECV]';
        return `${dir} ${t.from_name || 'Unknown'}: ${t.body_preview?.substring(0, 150) || '(empty)'}`;
      }).join('\n---\n')
    : 'This is a new conversation thread.';

  const meetingSummaries = recentMeetings.length > 0
    ? recentMeetings.map(m => {
        let info = `### ${m.title} (${m.date})\n`;
        if (m.summary) info += `Summary: ${m.summary}\n`;
        if (m.analysis?.buyingSignals?.length) {
          info += `Buying Signals: ${m.analysis.buyingSignals.map(s => s.signal).join(', ')}\n`;
        }
        return info;
      }).join('\n')
    : 'No recent meetings.';

  const emailBody = email.body_text || email.body_preview || '(No body content)';

  const prompt = `You are analyzing an inbound email for a sales team. Your job is to understand:
1. Who is this person and what's our relationship?
2. What are they asking for or telling us?
3. What buying signals or concerns are present?
4. What should we do next?
5. Draft a response if appropriate.

Be specific - reference actual data from the context. Never be generic.

## CONTEXT ABOUT THE SENDER

<sender>
Name: ${contact?.name || email.from_name || 'Unknown'}
Email: ${email.from_email}
Title: ${contact?.title || 'Unknown'}
Company: ${company?.name || 'Unknown'}
Industry: ${company?.industry || 'Unknown'}
Company Segment: ${company?.segment || 'Unknown'}
</sender>

<active_deal>
Deal Name: ${deal?.name || 'No active deal'}
Value: ${deal?.estimated_value ? `$${deal.estimated_value.toLocaleString()}` : 'Unknown'}
Stage: ${deal?.stage || 'N/A'}
</active_deal>

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
    "tier_trigger": "demo_request | pricing_request | email_reply | meeting_request",
    "sla_minutes": 120,
    "why_now": "One compelling sentence"
  }
}

Important guidelines:
- Be specific and reference actual data from the context
- For buying_signals and concerns_detected, quote directly from the email when possible
- The response_draft should be professional, warm, and reference specific context
- For command_center_classification:
  - Tier 1 (RESPOND NOW): Demo requests, pricing questions, direct replies waiting for response
  - Tier 2 (DON'T LOSE THIS): Competitive mentions, deadline pressure
  - Tier 3 (KEEP YOUR WORD): Follow-ups on commitments we made
  - Tier 4 (MOVE BIG DEALS): High-value deals needing attention
  - Tier 5 (BUILD PIPELINE): Everything else
- If arrays are empty (no signals, no concerns), use empty arrays []

Respond ONLY with valid JSON, no markdown or extra text.`;

  // 4. Call Claude
  console.log('\n🤖 CALLING CLAUDE...');
  const startTime = Date.now();

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
    console.error('Unexpected response type from AI');
    return;
  }

  let jsonText = textContent.text.trim();
  if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
  if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
  if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
  jsonText = jsonText.trim();

  let analysis;
  try {
    analysis = JSON.parse(jsonText);
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    console.error('Raw response:', jsonText);
    return;
  }

  // 6. Display results
  console.log(`\n⏱️ Analysis completed in ${latencyMs}ms`);
  console.log(`   Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  console.log('\n' + '='.repeat(70));
  console.log('📊 ANALYSIS RESULTS');
  console.log('='.repeat(70));

  const ea = analysis.email_analysis;
  console.log('\n📝 EMAIL ANALYSIS:');
  console.log(`  Type: ${ea.request_type}`);
  console.log(`  Summary: ${ea.summary}`);
  console.log(`  Full Understanding: ${ea.full_understanding}`);
  console.log(`  Urgency: ${ea.urgency}`);
  console.log(`  Sentiment: ${ea.sentiment}`);
  console.log(`  Tone: ${ea.tone}`);
  if (ea.key_questions?.length > 0) {
    console.log(`  Key Questions:`);
    ea.key_questions.forEach((q: string) => console.log(`    - ${q}`));
  }

  if (analysis.buying_signals?.length > 0) {
    console.log('\n🎯 BUYING SIGNALS:');
    analysis.buying_signals.forEach((s: { signal: string; quote: string; strength: string; implication: string }) => {
      console.log(`  [${s.strength.toUpperCase()}] ${s.signal}`);
      console.log(`    Quote: "${s.quote}"`);
      console.log(`    Implication: ${s.implication}`);
    });
  } else {
    console.log('\n🎯 BUYING SIGNALS: None detected');
  }

  if (analysis.concerns_detected?.length > 0) {
    console.log('\n⚠️ CONCERNS:');
    analysis.concerns_detected.forEach((c: { concern: string; quote: string; severity: string; suggested_response: string }) => {
      console.log(`  [${c.severity.toUpperCase()}] ${c.concern}`);
      if (c.quote) console.log(`    Quote: "${c.quote}"`);
      console.log(`    Response: ${c.suggested_response}`);
    });
  } else {
    console.log('\n⚠️ CONCERNS: None detected');
  }

  console.log('\n✅ SUGGESTED ACTIONS:');
  analysis.suggested_actions?.forEach((a: { action: string; priority: string; reasoning: string }) => {
    console.log(`  [${a.priority.toUpperCase()}] ${a.action}`);
    console.log(`    Why: ${a.reasoning}`);
  });

  const cc = analysis.command_center_classification;
  console.log('\n📍 COMMAND CENTER CLASSIFICATION:');
  console.log(`  Tier: ${cc.tier}`);
  console.log(`  Trigger: ${cc.tier_trigger}`);
  console.log(`  SLA: ${cc.sla_minutes} minutes`);
  console.log(`  Why Now: ${cc.why_now}`);

  console.log('\n📧 DRAFT RESPONSE:');
  console.log(`  Subject: ${analysis.response_draft.subject}`);
  console.log('-'.repeat(50));
  console.log(analysis.response_draft.body);
  console.log('-'.repeat(50));

  // Return the analysis for further use
  return analysis;
}

// Run with email ID from command line
const emailId = process.argv[2] || 'cc823e12-b5ce-41d0-a2d2-114671bf1690';
analyzeEmail(emailId).catch(console.error);
