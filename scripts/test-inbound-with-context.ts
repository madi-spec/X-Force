/**
 * Test inbound email analysis with relationship context
 * This test ensures we can see the full context-aware analysis in action
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('='.repeat(70));
  console.log('INBOUND EMAIL ANALYSIS WITH CONTEXT TEST');
  console.log('='.repeat(70));

  // Step 1: Get a contact that has relationship intelligence
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, contact_id, interactions, open_commitments')
    .not('contact_id', 'is', null);

  console.log(`\nFound ${riRecords?.length || 0} relationship intelligence records\n`);

  // Find one with interactions
  let richContact = null;
  let richRI = null;

  for (const ri of (riRecords || [])) {
    const interactions = ri.interactions as any[];
    if (interactions && interactions.length > 0) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name, email, company_id')
        .eq('id', ri.contact_id)
        .single();

      if (contact?.email) {
        richContact = contact;
        richRI = ri;
        break;
      }
    }
  }

  if (richContact && richRI) {
    console.log('─'.repeat(70));
    console.log('CONTACT WITH RELATIONSHIP HISTORY:');
    console.log('─'.repeat(70));
    console.log(`Name: ${richContact.name}`);
    console.log(`Email: ${richContact.email}`);
    console.log(`Interactions: ${(richRI.interactions as any[]).length}`);
    console.log(`Commitments (ours): ${(richRI.open_commitments as any)?.ours?.length || 0}`);
    console.log(`Commitments (theirs): ${(richRI.open_commitments as any)?.theirs?.length || 0}`);

    // Show the interactions
    console.log('\nPrior Interactions:');
    for (const int of (richRI.interactions as any[])) {
      console.log(`  - [${int.type}] ${int.date}: ${int.summary}`);
    }

    // Check if we have any inbound emails from this contact
    const { data: inboundEmails } = await supabase
      .from('email_messages')
      .select('id, subject, from_email, body_preview, received_at')
      .eq('is_sent_by_user', false)
      .ilike('from_email', richContact.email)
      .limit(5);

    if (inboundEmails && inboundEmails.length > 0) {
      console.log('\n✅ Found inbound emails from this contact!');
      for (const e of inboundEmails) {
        console.log(`  - ${e.subject} (${e.received_at})`);
      }
    } else {
      console.log('\n⚠️ No inbound emails from this contact');
    }
  }

  // Step 2: Find any inbound email with actual content and process it
  console.log('\n' + '─'.repeat(70));
  console.log('TESTING WITH AN INBOUND EMAIL');
  console.log('─'.repeat(70));

  const { data: allInbound } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, from_name, body_text, body_html, body_preview, received_at')
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(20);

  // Find one with actual content
  let testEmail = null;
  for (const email of (allInbound || [])) {
    const body = email.body_text || email.body_html || '';
    if (body.length > 200) {
      testEmail = email;
      break;
    }
  }

  if (!testEmail) {
    console.log('\nNo inbound emails with substantial content found.');
    console.log('Showing what the analysis would look like with the first available email...\n');
    testEmail = (allInbound || [])[0];
  }

  if (!testEmail) {
    console.log('No inbound emails found at all!');
    return;
  }

  console.log(`\n📧 EMAIL TO ANALYZE:`);
  console.log(`   From: ${testEmail.from_name} <${testEmail.from_email}>`);
  console.log(`   Subject: ${testEmail.subject}`);
  console.log(`   Date: ${testEmail.received_at}`);
  console.log(`   Preview: ${(testEmail.body_preview || '').substring(0, 200)}`);

  // Import the analysis functions
  const { buildRelationshipContext } = await import('../src/lib/intelligence/buildRelationshipContext');
  const { processInboundEmail } = await import('../src/lib/intelligence/analyzeInboundEmail');

  // Build and show the relationship context
  console.log('\n📋 RELATIONSHIP CONTEXT BEING SENT TO CLAUDE:');
  console.log('─'.repeat(50));

  const context = await buildRelationshipContext({ email: testEmail.from_email });

  // Show structured summary
  console.log(`Contact: ${context.structured.contact?.name || 'Unknown'}`);
  console.log(`Company: ${context.structured.company?.name || 'Unknown'}`);
  console.log(`Deal: ${context.structured.deal?.name || 'None'}`);
  console.log(`Prior Interactions: ${context.structured.interactions.length}`);
  console.log(`Open Commitments (ours): ${context.structured.openCommitments.ours.length}`);
  console.log(`Open Commitments (theirs): ${context.structured.openCommitments.theirs.length}`);
  console.log(`Buying Signals: ${context.structured.buyingSignals.length}`);
  console.log(`Concerns: ${context.structured.concerns.length}`);
  console.log(`Notes: ${context.structured.notes.length}`);

  // Show full prompt context
  console.log('\n--- FULL PROMPT CONTEXT (what Claude sees) ---');
  console.log(context.promptContext);
  console.log('--- END PROMPT CONTEXT ---');

  // Reset analysis to force reprocessing
  await supabase
    .from('email_messages')
    .update({ analysis_complete: false, ai_analysis: null })
    .eq('id', testEmail.id);

  // Run analysis
  console.log('\n🔄 RUNNING ANALYSIS...\n');

  const result = await processInboundEmail(testEmail.id);

  if (!result.success) {
    console.log(`❌ Error: ${result.error}`);
    return;
  }

  const analysis = result.analysis!;

  // Display full analysis results
  console.log('=' .repeat(70));
  console.log('ANALYSIS RESULTS');
  console.log('='.repeat(70));

  console.log(`\n📝 SUMMARY: ${analysis.summary}`);
  console.log(`   Request Type: ${analysis.request_type}`);
  console.log(`   Sentiment: ${analysis.sentiment}`);
  console.log(`   Urgency: ${analysis.urgency}`);

  console.log('\n📖 FULL ANALYSIS:');
  console.log(analysis.full_analysis);

  if (analysis.context_connections.length > 0) {
    console.log('\n🔗 CONTEXT CONNECTIONS (references to prior interactions):');
    for (const conn of analysis.context_connections) {
      console.log(`   • ${conn.connection}`);
      console.log(`     Prior Date: ${conn.prior_date || 'N/A'}`);
      console.log(`     Relevance: ${conn.relevance}`);
    }
  }

  if (analysis.key_questions.length > 0) {
    console.log('\n❓ KEY QUESTIONS TO ANSWER:');
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
    console.log(`     Reasoning: ${action.reasoning}`);
  }

  console.log('\n📬 PERSONALIZED DRAFT RESPONSE:');
  console.log(`   Subject: ${analysis.response_draft.subject}`);
  console.log('   Body:');
  const bodyLines = analysis.response_draft.body.split('\n');
  for (const line of bodyLines) {
    console.log(`   ${line}`);
  }

  console.log('\n🎯 COMMAND CENTER CLASSIFICATION:');
  const cc = analysis.command_center_classification;
  const tierNames = [
    '',
    'RESPOND NOW (Tier 1)',
    "DON'T LOSE THIS (Tier 2)",
    'KEEP YOUR WORD (Tier 3)',
    'MOVE BIG DEALS (Tier 4)',
    'BUILD PIPELINE (Tier 5)',
  ];
  console.log(`   ${tierNames[cc.tier]}`);
  console.log(`   Trigger: ${cc.tier_trigger}`);
  console.log(`   SLA: ${cc.sla_minutes} minutes`);
  console.log(`   Why Now: ${cc.why_now}`);

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
