/**
 * Test inbound email analysis WITH rich relationship context
 * This creates a synthetic scenario to demonstrate the full capability
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
  console.log('INBOUND EMAIL ANALYSIS - RICH CONTEXT DEMONSTRATION');
  console.log('='.repeat(70));

  // Find a contact with rich relationship history
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, contact_id, company_id, interactions, open_commitments, signals')
    .not('contact_id', 'is', null);

  let richRI = null;
  let richContact = null;

  for (const ri of (riRecords || [])) {
    const interactions = ri.interactions as any[];
    if (interactions && interactions.length > 0) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name, email, title, company_id')
        .eq('id', ri.contact_id)
        .single();

      if (contact) {
        richContact = contact;
        richRI = ri;
        break;
      }
    }
  }

  if (!richContact) {
    console.log('No contacts with relationship history found!');
    return;
  }

  console.log('\n📊 USING CONTACT WITH EXISTING RELATIONSHIP HISTORY:');
  console.log('─'.repeat(50));
  console.log(`Name: ${richContact.name}`);
  console.log(`Email: ${richContact.email}`);
  console.log(`Prior Interactions: ${(richRI.interactions as any[]).length}`);
  console.log(`Open Commitments (ours): ${(richRI.open_commitments as any)?.ours?.length || 0}`);

  // Get company info
  let companyName = 'Unknown';
  if (richContact.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', richContact.company_id)
      .single();
    companyName = company?.name || 'Unknown';
  }
  console.log(`Company: ${companyName}`);

  // Show existing interactions
  console.log('\nExisting Interactions:');
  for (const int of (richRI.interactions as any[]).slice(-3)) {
    console.log(`  • [${int.type}] ${int.date?.split('T')[0]}: ${int.summary?.substring(0, 80)}...`);
  }

  // Create a temporary synthetic inbound email to test with
  // Generate a proper UUID v4
  const syntheticEmailId = 'aaaaaaaa-bbbb-4ccc-dddd-' + Date.now().toString(16).padStart(12, '0');
  const syntheticEmail = {
    id: syntheticEmailId,
    user_id: '00000000-0000-0000-0000-000000000001', // Placeholder
    from_email: richContact.email,
    from_name: richContact.name,
    to_emails: ['sales@x-rai.com'],
    subject: 'Quick question about the demo we discussed',
    body_text: `Hi,

Thanks for the demo last week - it was really impressive! I showed the recording to our operations manager and he had a few questions:

1. How does the AI handle Spanish-speaking callers? We have a lot of Hispanic customers in our area.
2. What's the typical setup time? We're hoping to go live before our busy season starts in March.
3. Can it integrate with PestPac? That's our main scheduling software.

Also, I wanted to let you know that I spoke with our CEO yesterday and he's very interested. He wants to be on the next call to discuss pricing and implementation timeline.

Looking forward to hearing back!

Best,
${richContact.name}`,
    body_preview: 'Thanks for the demo last week - it was really impressive! I showed the recording...',
    received_at: new Date().toISOString(),
    is_sent_by_user: false,
    analysis_complete: false,
  };

  // Insert the synthetic email
  console.log('\n📧 CREATING TEST INBOUND EMAIL:');
  console.log('─'.repeat(50));
  console.log(`From: ${syntheticEmail.from_name} <${syntheticEmail.from_email}>`);
  console.log(`Subject: ${syntheticEmail.subject}`);
  console.log(`Body:\n${syntheticEmail.body_text}`);

  const { error: insertError } = await supabase
    .from('email_messages')
    .insert(syntheticEmail);

  if (insertError) {
    console.log(`Error inserting test email: ${insertError.message}`);
    // Try to continue with just the analysis demo
  }

  // Import and show the relationship context
  const { buildRelationshipContext } = await import('../src/lib/intelligence/buildRelationshipContext');

  console.log('\n📋 FULL RELATIONSHIP CONTEXT (sent to Claude):');
  console.log('─'.repeat(50));

  const context = await buildRelationshipContext({ email: richContact.email });

  console.log(`Contact: ${context.structured.contact?.name || 'Unknown'}`);
  console.log(`Company: ${context.structured.company?.name || 'Unknown'}`);
  console.log(`Deal: ${context.structured.deal?.name || 'None'}`);
  console.log(`Prior Interactions: ${context.structured.interactions.length}`);
  console.log(`Open Commitments (ours): ${context.structured.openCommitments.ours.length}`);
  console.log(`Open Commitments (theirs): ${context.structured.openCommitments.theirs.length}`);
  console.log(`Buying Signals: ${context.structured.buyingSignals.length}`);
  console.log(`Concerns: ${context.structured.concerns.length}`);

  // Show the full prompt context that Claude receives
  console.log('\n--- FULL PROMPT CONTEXT ---');
  console.log(context.promptContext);
  console.log('--- END PROMPT CONTEXT ---');

  // Run the analysis
  console.log('\n🔄 ANALYZING EMAIL WITH FULL CONTEXT...\n');

  const { processInboundEmail } = await import('../src/lib/intelligence/analyzeInboundEmail');

  const result = await processInboundEmail(syntheticEmailId);

  // Clean up - delete the test email
  await supabase.from('email_messages').delete().eq('id', syntheticEmailId);

  if (!result.success) {
    console.log(`❌ Error: ${result.error}`);
    return;
  }

  const analysis = result.analysis!;

  // Display full results
  console.log('='.repeat(70));
  console.log('ANALYSIS RESULTS (Context-Aware)');
  console.log('='.repeat(70));

  console.log(`\n📝 SUMMARY: ${analysis.summary}`);
  console.log(`   Request Type: ${analysis.request_type}`);
  console.log(`   Sentiment: ${analysis.sentiment}`);
  console.log(`   Urgency: ${analysis.urgency}`);

  console.log('\n📖 FULL ANALYSIS (should reference prior interactions):');
  console.log(analysis.full_analysis);

  console.log('\n🔗 CONTEXT CONNECTIONS (how this relates to prior interactions):');
  if (analysis.context_connections.length > 0) {
    for (const conn of analysis.context_connections) {
      console.log(`   • ${conn.connection}`);
      if (conn.prior_date) console.log(`     Prior Date: ${conn.prior_date}`);
      console.log(`     Relevance: ${conn.relevance}`);
    }
  } else {
    console.log('   (None detected)');
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

  if (analysis.commitment_updates.new_theirs.length > 0) {
    console.log('\n🤝 NEW COMMITMENTS FROM THEM:');
    for (const c of analysis.commitment_updates.new_theirs) {
      console.log(`   • ${c.commitment}`);
      if (c.expected_by) console.log(`     Expected by: ${c.expected_by}`);
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
