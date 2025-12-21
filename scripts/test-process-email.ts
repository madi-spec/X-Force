/**
 * Test Email Processing Pipeline
 *
 * Run with: npx tsx scripts/test-process-email.ts <email_id>
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================
// INTERNAL DOMAINS
// ============================================

const INTERNAL_DOMAINS = new Set([
  'xrailabsteam.com', 'xrailabs.com', 'affiliatedtech.com', 'x-rai.com',
]);

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'live.com', 'msn.com', 'mail.com',
]);

function extractDomain(email: string): string {
  return email.toLowerCase().split('@')[1] || '';
}

function isInternalEmail(email: string): boolean {
  return INTERNAL_DOMAINS.has(extractDomain(email));
}

// ============================================
// MAIN TEST
// ============================================

async function testProcessEmail(emailId: string) {
  console.log('='.repeat(70));
  console.log('EMAIL PROCESSING PIPELINE TEST');
  console.log('='.repeat(70));

  // 1. Get the email
  const { data: email, error: emailError } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', emailId)
    .single();

  if (emailError || !email) {
    console.error('Email not found:', emailError?.message);
    return;
  }

  console.log('\n📧 EMAIL:');
  console.log(`  From: ${email.from_name} <${email.from_email}>`);
  console.log(`  Subject: ${email.subject}`);
  console.log(`  Received: ${email.received_at}`);
  console.log(`  Is Outbound: ${email.is_sent_by_user}`);
  console.log(`  Analysis Complete: ${email.analysis_complete}`);

  if (email.is_sent_by_user) {
    console.log('\n❌ Cannot process outbound emails');
    return;
  }

  if (isInternalEmail(email.from_email)) {
    console.log('\n⏭️ Skipping internal email');
    return;
  }

  // 2. Check if already replied
  const { data: replies } = await supabase
    .from('email_messages')
    .select('id')
    .eq('conversation_ref', email.conversation_ref)
    .eq('is_sent_by_user', true)
    .gt('received_at', email.received_at)
    .limit(1);

  const alreadyReplied = (replies?.length || 0) > 0;
  console.log(`\n📬 Already Replied: ${alreadyReplied}`);

  if (alreadyReplied) {
    console.log('⏭️ Skipping - already replied');
    return;
  }

  // 3. Check if CC item exists
  const { data: existingItem } = await supabase
    .from('command_center_items')
    .select('id, title, tier, why_now')
    .eq('conversation_id', email.conversation_ref)
    .eq('user_id', email.user_id)
    .eq('status', 'pending')
    .single();

  if (existingItem) {
    console.log('\n⚠️ Command Center item already exists:');
    console.log(`  ID: ${existingItem.id}`);
    console.log(`  Title: ${existingItem.title}`);
    console.log(`  Tier: ${existingItem.tier}`);
    console.log(`  Why Now: ${existingItem.why_now}`);
    return;
  }

  // 4. Get context
  console.log('\n🔍 Gathering context...');

  let contact = null;
  let company = null;
  let deal = null;

  const emailLower = email.from_email.toLowerCase();
  const domain = extractDomain(email.from_email);

  // Find contact
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, title, company_id')
    .ilike('email', emailLower)
    .single();

  if (existingContact) {
    contact = existingContact;
    console.log(`  Contact: ${contact.name}`);
  }

  // Find company
  if (!PERSONAL_DOMAINS.has(domain)) {
    if (contact?.company_id) {
      const { data: linkedCompany } = await supabase
        .from('companies')
        .select('id, name, industry, segment')
        .eq('id', contact.company_id)
        .single();
      if (linkedCompany) {
        company = linkedCompany;
        console.log(`  Company: ${company.name}`);
      }
    }
    if (!company) {
      const { data: domainCompany } = await supabase
        .from('companies')
        .select('id, name, industry, segment')
        .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
        .single();
      if (domainCompany) {
        company = domainCompany;
        console.log(`  Company: ${company.name} (from domain)`);
      }
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
    if (activeDeal) {
      deal = activeDeal;
      console.log(`  Deal: ${deal.name} ($${deal.estimated_value?.toLocaleString()}, ${deal.stage})`);
    }
  }

  // Get thread context
  const { data: thread } = await supabase
    .from('email_messages')
    .select('id, is_sent_by_user, from_name, body_preview')
    .eq('conversation_ref', email.conversation_ref)
    .neq('id', email.id)
    .order('received_at', { ascending: false })
    .limit(5);

  console.log(`  Thread: ${thread?.length || 0} prior messages`);

  // 5. Build prompt and call Claude
  console.log('\n🤖 Calling Claude for analysis...');
  const startTime = Date.now();

  const threadContext = thread && thread.length > 0
    ? thread.map(t => {
        const dir = t.is_sent_by_user ? '[SENT]' : '[RECV]';
        return `${dir} ${t.from_name || 'Unknown'}: ${t.body_preview?.substring(0, 150) || '(empty)'}`;
      }).join('\n---\n')
    : 'This is a new conversation thread.';

  const emailBody = email.body_text || email.body_preview || '(No body content)';

  const prompt = `You are analyzing an inbound email for a sales team. Be specific - reference actual data from the context.

## CONTEXT
Sender: ${contact?.name || email.from_name || 'Unknown'} <${email.from_email}>
Title: ${contact?.title || 'Unknown'}
Company: ${company?.name || 'Unknown'} (${company?.industry || 'Unknown'})
Deal: ${deal?.name || 'No active deal'} ${deal ? `($${deal.estimated_value?.toLocaleString()}, ${deal.stage})` : ''}

## EMAIL THREAD
${threadContext}

## NEW EMAIL
Subject: ${email.subject || '(No subject)'}
Date: ${email.received_at}

${emailBody}

---

Analyze and return JSON:
{
  "email_analysis": {
    "request_type": "demo_request | pricing_question | general_question | meeting_request | follow_up | complaint | info_share | introduction | other",
    "summary": "One sentence summary",
    "urgency": "High | Medium | Low",
    "sentiment": "Very Positive | Positive | Neutral | Concerned | Frustrated | Negative"
  },
  "buying_signals": [{"signal": "...", "quote": "...", "strength": "strong|moderate|weak"}],
  "concerns_detected": [{"concern": "...", "severity": "high|medium|low"}],
  "suggested_actions": [{"action": "...", "priority": "high|medium|low"}],
  "response_draft": {"subject": "Re: ...", "body": "..."},
  "command_center_classification": {
    "tier": 1,
    "tier_trigger": "demo_request | pricing_request | email_reply | meeting_request",
    "sla_minutes": 120,
    "why_now": "One compelling sentence"
  }
}

Respond ONLY with valid JSON.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  });

  const latencyMs = Date.now() - startTime;
  console.log(`  Completed in ${latencyMs}ms`);
  console.log(`  Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  // Parse response
  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    console.error('No text response from AI');
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
    console.error('Raw:', jsonText);
    return;
  }

  // 6. Display results
  console.log('\n' + '='.repeat(70));
  console.log('📊 ANALYSIS RESULTS');
  console.log('='.repeat(70));

  const ea = analysis.email_analysis;
  console.log('\n📝 EMAIL ANALYSIS:');
  console.log(`  Type: ${ea.request_type}`);
  console.log(`  Summary: ${ea.summary}`);
  console.log(`  Urgency: ${ea.urgency}`);
  console.log(`  Sentiment: ${ea.sentiment}`);

  if (analysis.buying_signals?.length > 0) {
    console.log('\n🎯 BUYING SIGNALS:');
    analysis.buying_signals.forEach((s: any) => {
      console.log(`  [${s.strength}] ${s.signal}`);
    });
  }

  if (analysis.concerns_detected?.length > 0) {
    console.log('\n⚠️ CONCERNS:');
    analysis.concerns_detected.forEach((c: any) => {
      console.log(`  [${c.severity}] ${c.concern}`);
    });
  }

  const cc = analysis.command_center_classification;
  console.log('\n📍 COMMAND CENTER:');
  console.log(`  Tier: ${cc.tier}`);
  console.log(`  Trigger: ${cc.tier_trigger}`);
  console.log(`  SLA: ${cc.sla_minutes} minutes`);
  console.log(`  Why Now: ${cc.why_now}`);

  console.log('\n✅ SUGGESTED ACTIONS:');
  analysis.suggested_actions?.forEach((a: any) => {
    console.log(`  [${a.priority}] ${a.action}`);
  });

  console.log('\n📧 DRAFT RESPONSE:');
  console.log(`  Subject: ${analysis.response_draft.subject}`);
  console.log('-'.repeat(50));
  console.log(analysis.response_draft.body.substring(0, 500));
  if (analysis.response_draft.body.length > 500) console.log('...');

  // 7. Create command center item
  console.log('\n' + '='.repeat(70));
  console.log('💾 CREATING COMMAND CENTER ITEM...');

  // Get conversation details
  const { data: conv } = await supabase
    .from('email_conversations')
    .select('deal_id, company_id, contact_id')
    .eq('id', email.conversation_ref)
    .single();

  const fromName = email.from_name || email.from_email.split('@')[0];
  const slaDueAt = new Date(email.received_at);
  slaDueAt.setMinutes(slaDueAt.getMinutes() + cc.sla_minutes);

  const { data: newItem, error: insertError } = await supabase
    .from('command_center_items')
    .insert({
      user_id: email.user_id,
      conversation_id: email.conversation_ref,
      deal_id: conv?.deal_id || deal?.id || null,
      company_id: conv?.company_id || company?.id || null,
      contact_id: conv?.contact_id || contact?.id || null,
      action_type: ea.request_type === 'demo_request' ? 'call' : 'email_respond',
      title: `${ea.request_type === 'demo_request' ? 'Demo request from' : 'Reply to'} ${fromName}`,
      description: ea.summary,
      why_now: cc.why_now,
      tier: cc.tier,
      tier_trigger: cc.tier_trigger,
      sla_minutes: cc.sla_minutes,
      sla_status: 'on_track',
      received_at: email.received_at,
      due_at: slaDueAt.toISOString(),
      target_name: fromName,
      company_name: company?.name || null,
      deal_value: deal?.estimated_value || null,
      deal_stage: deal?.stage || null,
      status: 'pending',
      source: 'email_ai_analysis',
      email_analysis: ea,
      buying_signals: analysis.buying_signals,
      concerns: analysis.concerns_detected,
      suggested_actions: analysis.suggested_actions,
      email_draft: analysis.response_draft,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to create item:', insertError.message);
  } else {
    console.log(`✅ Created: ${newItem?.id}`);

    // Update email record
    await supabase
      .from('email_messages')
      .update({
        ai_analysis: analysis,
        analysis_complete: true,
        processed_for_cc: true,
        cc_processed_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    console.log('✅ Email marked as analyzed');
  }
}

const emailId = process.argv[2] || 'ddc94e17-5715-4a1f-9885-5015e198906b';
testProcessEmail(emailId).catch(console.error);
