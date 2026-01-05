/**
 * Integration Test: Known Contact Scenario
 *
 * Tests the pipeline with an email from a known contact (Andy Canniff)
 * to demonstrate full entity matching and context growth.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import {
  processIncomingCommunication,
  buildFullRelationshipContext,
} from '../src/lib/intelligence/contextFirstPipeline';
import { CommunicationInput } from '../src/lib/intelligence/entityMatcher';

async function runTest() {
  console.log('\n' + '='.repeat(80));
  console.log('INTEGRATION TEST: Known Contact - Andy Canniff');
  console.log('='.repeat(80) + '\n');

  const supabase = createAdminClient();

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .not('auth_id', 'is', null)
    .limit(1)
    .single();

  if (!user) {
    console.error('❌ No user found');
    return;
  }

  console.log(`Testing as user: ${user.email}\n`);

  // Get current context for Lawn Doctor BEFORE processing
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%Lawn Doctor of Hanover%')
    .single();

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, email')
    .ilike('name', '%Canniff%')
    .eq('company_id', company?.id)
    .single();

  console.log('─'.repeat(80));
  console.log('EXISTING DATA');
  console.log('─'.repeat(80));
  console.log(`  Company: ${company?.name} (${company?.id})`);
  console.log(`  Contact: ${contact?.name} <${contact?.email}> (${contact?.id})`);

  // Get context BEFORE
  const contextBefore = await buildFullRelationshipContext({
    companyId: company?.id || null,
    contactId: contact?.id || null,
  });

  const factsBefore = contextBefore.relationshipIntelligence?.key_facts?.length || 0;
  const interactionsBefore = contextBefore.relationshipIntelligence?.interactions?.length || 0;

  console.log(`  Facts before: ${factsBefore}`);
  console.log(`  Interactions before: ${interactionsBefore}`);
  console.log();

  // Create a realistic follow-up email from Andy
  const email: CommunicationInput = {
    type: 'email_inbound',
    from_email: 'acanniff@lawndoctorma.com',
    from_name: 'Andy Canniff',
    subject: 'Quick question about X-RAI trial setup',
    body: `Hi team,

I wanted to follow up on our trial setup. We're really excited to get started!

A few questions:

1. When will we get our login credentials for the X-RAI dashboard?
2. Do you need our FieldRoutes API key, or does your system use a different integration method?
3. Can we start with just our customer service team (8 agents) for the first week before rolling out to the full 16?

Also, I spoke with our Operations Director, Maria Santos, and she's very interested in seeing how X-RAI can help with our quality assurance process. Would it be possible to include her on the kickoff call?

Looking forward to getting this going!

Best,
Andy Canniff
VP/GM
Lawn Doctor of Hanover
(781) 831-2165
`,
  };

  console.log('─'.repeat(80));
  console.log('INPUT EMAIL');
  console.log('─'.repeat(80));
  console.log(`  From: ${email.from_name} <${email.from_email}>`);
  console.log(`  Subject: ${email.subject}`);
  console.log();

  console.log('─'.repeat(80));
  console.log('PROCESSING...');
  console.log('─'.repeat(80));
  console.log();

  const startTime = Date.now();
  const result = await processIncomingCommunication(email, user.id);
  const elapsed = Date.now() - startTime;

  // Results
  console.log('\n' + '═'.repeat(80));
  console.log('ENTITY MATCHING');
  console.log('═'.repeat(80) + '\n');

  console.log(`  Company: ${result.company?.name || 'NOT FOUND'}`);
  console.log(`  Contact: ${result.contact?.name || 'NOT FOUND'}`);
  console.log(`  Confidence: ${(result.matchConfidence * 100).toFixed(0)}%`);
  console.log(`  Reasoning: ${result.matchReasoning}`);

  console.log('\n' + '═'.repeat(80));
  console.log('ANALYSIS RESULTS');
  console.log('═'.repeat(80) + '\n');

  console.log(`  Communication Type: ${result.analysisWithContext.communication_type}`);

  console.log('\n  Key Facts Learned:');
  result.analysisWithContext.key_facts_learned.forEach((f, i) => {
    console.log(`    ${i + 1}. ${f.fact}`);
  });

  console.log('\n  Buying Signals:');
  result.analysisWithContext.buying_signals.forEach((s, i) => {
    console.log(`    ${i + 1}. [${s.strength.toUpperCase()}] ${s.signal}`);
  });

  console.log('\n  Commitments From Us:');
  result.analysisWithContext.commitment_updates.new_ours.forEach((c, i) => {
    console.log(`    ${i + 1}. ${c.commitment}`);
  });

  console.log('\n  Suggested Actions:');
  result.analysisWithContext.suggested_actions.forEach((a, i) => {
    console.log(`    ${i + 1}. [${a.priority.toUpperCase()}] ${a.title}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('CONTEXT GROWTH');
  console.log('═'.repeat(80) + '\n');

  const factsAfter = result.contextAfter?.relationshipIntelligence?.key_facts?.length || 0;
  const interactionsAfter = result.contextAfter?.relationshipIntelligence?.interactions?.length || 0;

  console.log(`  Facts: ${factsBefore} → ${factsAfter}`);
  console.log(`  Interactions: ${interactionsBefore} → ${interactionsAfter}`);
  console.log(`  Context Grew: ${factsAfter > factsBefore || interactionsAfter > interactionsBefore ? '✅ YES' : '❌ NO'}`);

  console.log('\n  Updated Relationship Summary:');
  console.log(`    ${result.analysisWithContext.relationship_summary_update}`);

  console.log('\n' + '═'.repeat(80));
  console.log('ACTIONS CREATED');
  console.log('═'.repeat(80) + '\n');

  result.actionsCreated.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.title}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('VALIDATION');
  console.log('═'.repeat(80) + '\n');

  const checks = [
    { name: 'Company matched correctly', pass: result.company?.name?.includes('Lawn Doctor') },
    { name: 'Contact matched correctly', pass: result.contact?.name?.includes('Canniff') },
    { name: 'High confidence (≥85%)', pass: result.matchConfidence >= 0.85 },
    { name: 'Context grew', pass: factsAfter > factsBefore || interactionsAfter > interactionsBefore },
    { name: 'Actions created', pass: result.actionsCreated.length > 0 },
    { name: 'Summary updated', pass: !!result.analysisWithContext.relationship_summary_update },
    { name: 'New stakeholder detected', pass: result.analysisWithContext.key_facts_learned.some(f => f.fact.toLowerCase().includes('maria')) },
  ];

  checks.forEach(c => console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`));

  const passed = checks.filter(c => c.pass).length;
  console.log(`\n  Result: ${passed}/${checks.length} checks passed`);
  console.log(`  Processing time: ${elapsed}ms`);

  if (passed === checks.length) {
    console.log('\n  🎉 ALL CHECKS PASSED!');
  }

  return result;
}

runTest().catch(console.error);
