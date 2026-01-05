/**
 * Test script for context-aware inbound email analysis
 * Run: npx tsx scripts/test-inbound-analysis.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { processInboundEmail } = await import(
    '../src/lib/intelligence/analyzeInboundEmail'
  );
  const { buildRelationshipContext } = await import(
    '../src/lib/intelligence/buildRelationshipContext'
  );

  const supabase = createAdminClient();

  console.log('='.repeat(70));
  console.log('INBOUND EMAIL ANALYSIS TEST');
  console.log('Testing context-aware analysis with full relationship history');
  console.log('='.repeat(70));

  // Strategy: Find inbound emails and check if their sender has relationship history
  // Prioritize emails from senders we know about

  // Step 1: Get contacts with relationship intelligence records
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('contact_id, interactions')
    .not('contact_id', 'is', null);

  const contactsWithHistory = new Set(
    (riRecords || [])
      .filter(r => (r.interactions || []).length > 0)
      .map(r => r.contact_id)
  );

  console.log(`\nFound ${contactsWithHistory.size} contacts with relationship history`);

  // Step 2: Get contact emails for those contacts
  const contactEmailMap = new Map<string, { id: string; name: string }>();
  if (contactsWithHistory.size > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email')
      .in('id', Array.from(contactsWithHistory));

    for (const c of contacts || []) {
      if (c.email) {
        contactEmailMap.set(c.email.toLowerCase(), { id: c.id, name: c.name });
      }
    }
  }

  // Step 3: Find inbound emails - prioritize those from known contacts
  const { data: allInboundEmails } = await supabase
    .from('email_messages')
    .select(
      'id, subject, from_email, from_name, received_at, body_preview, analysis_complete'
    )
    .eq('is_sent_by_user', false)
    .not('body_preview', 'is', null)
    .order('received_at', { ascending: false })
    .limit(50);

  // Separate into known vs unknown senders
  const fromKnownContacts: typeof allInboundEmails = [];
  const fromUnknownSenders: typeof allInboundEmails = [];

  for (const email of allInboundEmails || []) {
    const senderLower = (email.from_email || '').toLowerCase();
    if (contactEmailMap.has(senderLower)) {
      fromKnownContacts.push(email);
    } else {
      fromUnknownSenders.push(email);
    }
  }

  console.log(`Inbound emails from KNOWN contacts: ${fromKnownContacts.length}`);
  console.log(`Inbound emails from unknown senders: ${fromUnknownSenders.length}`);

  // Test emails to process
  const testEmails: Array<{
    email: (typeof allInboundEmails)[0];
    hasHistory: boolean;
  }> = [];

  // Add up to 2 emails from known contacts (with history)
  for (const email of fromKnownContacts.slice(0, 2)) {
    testEmails.push({ email, hasHistory: true });
  }

  // Add 1 email from unknown sender (no history)
  if (fromUnknownSenders.length > 0) {
    testEmails.push({ email: fromUnknownSenders[0], hasHistory: false });
  }

  // Fallback: if no emails from known contacts, use any inbound emails
  if (testEmails.length === 0 && (allInboundEmails || []).length > 0) {
    for (const email of (allInboundEmails || []).slice(0, 3)) {
      testEmails.push({ email, hasHistory: false });
    }
  }

  if (testEmails.length === 0) {
    console.log('\nNo inbound emails found to test!');
    return;
  }

  console.log(`\nWill test ${testEmails.length} emails\n`);

  // Process each test email
  for (let i = 0; i < testEmails.length; i++) {
    const { email, hasHistory } = testEmails[i];

    console.log('─'.repeat(70));
    console.log(`TEST ${i + 1}/${testEmails.length}: ${hasHistory ? 'WITH HISTORY' : 'NO HISTORY'}`);
    console.log('─'.repeat(70));

    console.log('\n📧 INCOMING EMAIL:');
    console.log(`   From: ${email.from_name} <${email.from_email}>`);
    console.log(`   Subject: ${email.subject}`);
    console.log(`   Date: ${email.received_at}`);
    console.log(`   Preview: ${(email.body_preview || '').substring(0, 150)}...`);

    // First, show the relationship context that will be used
    console.log('\n📋 RELATIONSHIP CONTEXT (sent to Claude):');
    console.log('─'.repeat(50));

    try {
      const context = await buildRelationshipContext({ email: email.from_email });

      // Show abbreviated context
      if (context.structured.contact) {
        console.log(`Contact: ${context.structured.contact.name}`);
      }
      if (context.structured.company) {
        console.log(`Company: ${context.structured.company.name}`);
      }
      if (context.structured.deal) {
        console.log(`Deal: ${context.structured.deal.name} (${context.structured.deal.stage})`);
      }
      console.log(`Prior Interactions: ${context.structured.interactions.length}`);
      console.log(
        `Open Commitments: Ours=${context.structured.openCommitments.ours.length}, Theirs=${context.structured.openCommitments.theirs.length}`
      );
      console.log(`Buying Signals: ${context.structured.buyingSignals.length}`);
      console.log(`Concerns: ${context.structured.concerns.length}`);
      console.log(`Notes: ${context.structured.notes.length}`);
      console.log(`Recent Meetings: ${context.structured.recentMeetings.length}`);

      // Show full promptContext if there's history
      if (context.structured.interactions.length > 0) {
        console.log('\n--- FULL PROMPT CONTEXT ---');
        console.log(context.promptContext);
        console.log('--- END PROMPT CONTEXT ---');
      }
    } catch (err) {
      console.log(`   Could not build context: ${err}`);
    }

    console.log('─'.repeat(50));

    // Reset analysis_complete to force reanalysis
    await supabase
      .from('email_messages')
      .update({ analysis_complete: false, ai_analysis: null })
      .eq('id', email.id);

    console.log('\n🔄 ANALYZING WITH FULL CONTEXT...\n');

    const result = await processInboundEmail(email.id);

    if (!result.success) {
      console.log(`   ❌ Error: ${result.error}`);
      continue;
    }

    const analysis = result.analysis!;

    // Show analysis results
    console.log('📊 ANALYSIS RESULTS:');
    console.log('─'.repeat(50));

    console.log(`\n📝 SUMMARY: ${analysis.summary}`);
    console.log(`   Type: ${analysis.request_type}`);
    console.log(`   Sentiment: ${analysis.sentiment}`);
    console.log(`   Urgency: ${analysis.urgency}`);

    console.log('\n📖 FULL ANALYSIS:');
    console.log(analysis.full_analysis);

    if (analysis.context_connections.length > 0) {
      console.log('\n🔗 CONTEXT CONNECTIONS (references to prior interactions):');
      for (const conn of analysis.context_connections) {
        console.log(`   • ${conn.connection}`);
        if (conn.prior_date) console.log(`     Prior date: ${conn.prior_date}`);
        console.log(`     Relevance: ${conn.relevance}`);
      }
    } else {
      console.log('\n🔗 No context connections (new relationship or no relevant history)');
    }

    if (analysis.key_questions.length > 0) {
      console.log('\n❓ KEY QUESTIONS:');
      for (const q of analysis.key_questions) {
        console.log(`   • ${q}`);
      }
    }

    if (analysis.key_facts_learned.length > 0) {
      console.log('\n💡 NEW FACTS LEARNED:');
      for (const fact of analysis.key_facts_learned) {
        console.log(`   • ${fact}`);
      }
    }

    if (analysis.signal_updates.new_buying_signals.length > 0) {
      console.log('\n📈 NEW BUYING SIGNALS:');
      for (const s of analysis.signal_updates.new_buying_signals) {
        console.log(`   • [${s.strength.toUpperCase()}] ${s.signal}`);
        console.log(`     Quote: "${s.quote}"`);
      }
    }

    if (analysis.signal_updates.new_concerns.length > 0) {
      console.log('\n⚠️ NEW CONCERNS:');
      for (const c of analysis.signal_updates.new_concerns) {
        console.log(`   • [${c.severity.toUpperCase()}] ${c.concern}`);
      }
    }

    console.log('\n🚀 RELATIONSHIP PROGRESSION:');
    console.log(`   Momentum: ${analysis.relationship_progression.momentum}`);
    console.log(`   Assessment: ${analysis.relationship_progression.assessment}`);

    console.log('\n✅ SUGGESTED ACTIONS:');
    for (const action of analysis.suggested_actions) {
      console.log(`   • [${action.priority.toUpperCase()}] ${action.action}`);
      console.log(`     Why: ${action.reasoning}`);
    }

    console.log('\n📬 DRAFT RESPONSE:');
    console.log(`   Subject: ${analysis.response_draft.subject}`);
    console.log('   Body:');
    console.log('   ' + analysis.response_draft.body.split('\n').join('\n   '));

    console.log('\n🎯 COMMAND CENTER CLASSIFICATION:');
    const cc = analysis.command_center_classification;
    const tierNames = ['', 'RESPOND NOW', "DON'T LOSE THIS", 'KEEP YOUR WORD', 'MOVE BIG DEALS', 'BUILD PIPELINE'];
    console.log(`   Tier ${cc.tier}: ${tierNames[cc.tier]}`);
    console.log(`   Trigger: ${cc.tier_trigger}`);
    console.log(`   SLA: ${cc.sla_minutes} minutes`);
    console.log(`   Why Now: ${cc.why_now}`);

    if (result.relationshipId) {
      console.log(`\n✅ Updated relationship: ${result.relationshipId}`);
    }

    console.log('\n');
  }

  console.log('='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
