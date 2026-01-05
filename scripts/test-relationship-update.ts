/**
 * Test unified relationship updates
 * Shows BEFORE and AFTER state when processing an email
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
  console.log('RELATIONSHIP UPDATE TEST');
  console.log('Testing that email analysis updates relationship intelligence');
  console.log('='.repeat(70));

  // Step 1: Find a contact with an existing relationship record
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, contact_id, company_id, interactions, open_commitments, signals, metrics, relationship_summary')
    .not('contact_id', 'is', null)
    .limit(5);

  if (!riRecords || riRecords.length === 0) {
    console.log('No relationship intelligence records found!');
    return;
  }

  // Find one with a contact
  let testRI = null;
  let testContact = null;

  for (const ri of riRecords) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, email, company_id')
      .eq('id', ri.contact_id)
      .single();

    if (contact?.email) {
      testRI = ri;
      testContact = contact;
      break;
    }
  }

  if (!testRI || !testContact) {
    console.log('No suitable contact with relationship record found!');
    return;
  }

  console.log(`\n📊 TEST CONTACT: ${testContact.name} <${testContact.email}>`);
  console.log('─'.repeat(70));

  // Step 2: Show BEFORE state
  console.log('\n📋 BEFORE STATE:');
  console.log('─'.repeat(50));

  const interactionsBefore = (testRI.interactions as any[]) || [];
  const signalsBefore = testRI.signals as any;
  const commitmentsBefore = testRI.open_commitments as any;
  const metricsBefore = testRI.metrics as any;

  console.log(`  Interactions: ${interactionsBefore.length}`);
  if (interactionsBefore.length > 0) {
    console.log('  Latest 3 interactions:');
    for (const int of interactionsBefore.slice(-3)) {
      console.log(`    - [${int.type}] ${int.date?.split('T')[0]}: ${int.summary?.substring(0, 60)}...`);
    }
  }

  console.log(`\n  Buying Signals: ${signalsBefore?.buying_signals?.length || 0}`);
  console.log(`  Concerns: ${signalsBefore?.concerns?.length || 0}`);
  console.log(`  Our Open Commitments: ${commitmentsBefore?.ours?.length || 0}`);
  console.log(`  Their Open Commitments: ${commitmentsBefore?.theirs?.length || 0}`);
  console.log(`\n  Metrics:`);
  console.log(`    Total Interactions: ${metricsBefore?.total_interactions || 0}`);
  console.log(`    Last Contact Date: ${metricsBefore?.last_contact_date || 'N/A'}`);
  console.log(`    Days in Relationship: ${metricsBefore?.days_in_relationship || 0}`);
  console.log(`\n  Summary: ${testRI.relationship_summary || '(none)'}`);

  // Step 3: Call the unified update function directly to simulate an email
  console.log('\n─'.repeat(70));
  console.log('🔄 SIMULATING EMAIL ANALYSIS UPDATE...');
  console.log('─'.repeat(70));

  const { updateRelationshipFromAnalysis } = await import(
    '../src/lib/intelligence/updateRelationshipFromAnalysis'
  );

  // Create a synthetic email analysis result
  const simulatedAnalysis = {
    type: 'email_inbound' as const,
    source_id: 'test-email-' + Date.now(),
    contact_id: testContact.id,
    company_id: testContact.company_id,
    date: new Date(),
    summary: 'Test: Customer asked about pricing and mentioned they need to go live by March',
    sentiment: 'Positive',
    key_facts_learned: [
      'They have a busy season starting in March',
      'They use PestPac for scheduling',
      'Their CEO is now involved in the decision',
    ],
    buying_signals: [
      {
        signal: 'CEO engagement in the sales process',
        quote: 'I spoke with our CEO yesterday and he is very interested',
        strength: 'strong' as const,
      },
      {
        signal: 'Timeline urgency expressed',
        quote: 'We need to go live before March',
        strength: 'moderate' as const,
      },
    ],
    concerns: [
      {
        concern: 'Integration with existing PestPac system',
        severity: 'medium' as const,
      },
    ],
    commitments_received: [
      {
        commitment: 'CEO will join the next pricing call',
        expected_by: '2025-01-15',
      },
    ],
  };

  console.log('\nSimulated email analysis:');
  console.log(`  Summary: ${simulatedAnalysis.summary}`);
  console.log(`  Key Facts: ${simulatedAnalysis.key_facts_learned?.length || 0}`);
  console.log(`  Buying Signals: ${simulatedAnalysis.buying_signals?.length || 0}`);
  console.log(`  Concerns: ${simulatedAnalysis.concerns?.length || 0}`);
  console.log(`  Their Commitments: ${simulatedAnalysis.commitments_received?.length || 0}`);

  // Run the update
  const result = await updateRelationshipFromAnalysis(simulatedAnalysis);

  console.log('\n📊 UPDATE RESULT:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Relationship ID: ${result.relationshipId}`);
  console.log(`  Changes:`, result.changes);

  if (!result.success) {
    console.log(`  Error: ${result.error}`);
    return;
  }

  // Step 4: Show AFTER state
  console.log('\n─'.repeat(70));
  console.log('📋 AFTER STATE:');
  console.log('─'.repeat(50));

  const { data: afterRI } = await supabase
    .from('relationship_intelligence')
    .select('interactions, open_commitments, signals, metrics, relationship_summary, context')
    .eq('id', result.relationshipId)
    .single();

  if (!afterRI) {
    console.log('Failed to fetch updated record!');
    return;
  }

  const interactionsAfter = (afterRI.interactions as any[]) || [];
  const signalsAfter = afterRI.signals as any;
  const commitmentsAfter = afterRI.open_commitments as any;
  const metricsAfter = afterRI.metrics as any;
  const contextAfter = afterRI.context as any;

  console.log(`  Interactions: ${interactionsAfter.length} (was ${interactionsBefore.length})`);
  if (interactionsAfter.length > 0) {
    console.log('  Latest 3 interactions:');
    for (const int of interactionsAfter.slice(-3)) {
      console.log(`    - [${int.type}] ${int.date?.split('T')[0]}: ${int.summary?.substring(0, 60)}...`);
    }
  }

  console.log(`\n  Buying Signals: ${signalsAfter?.buying_signals?.length || 0} (was ${signalsBefore?.buying_signals?.length || 0})`);
  if (signalsAfter?.buying_signals?.length > 0) {
    console.log('  New signals:');
    for (const s of signalsAfter.buying_signals.slice(-3)) {
      console.log(`    - [${s.strength}] ${s.signal}`);
    }
  }

  console.log(`\n  Concerns: ${signalsAfter?.concerns?.length || 0} (was ${signalsBefore?.concerns?.length || 0})`);
  if (signalsAfter?.concerns?.length > 0) {
    console.log('  Open concerns:');
    for (const c of signalsAfter.concerns.filter((x: any) => !x.resolved).slice(-3)) {
      console.log(`    - [${c.severity}] ${c.concern}`);
    }
  }

  console.log(`\n  Our Open Commitments: ${commitmentsAfter?.ours?.length || 0}`);
  console.log(`  Their Open Commitments: ${commitmentsAfter?.theirs?.length || 0} (was ${commitmentsBefore?.theirs?.length || 0})`);
  if (commitmentsAfter?.theirs?.length > 0) {
    console.log('  Their commitments:');
    for (const c of commitmentsAfter.theirs.filter((x: any) => x.status === 'pending').slice(-3)) {
      console.log(`    - ${c.commitment} (expected: ${c.expected_by || 'TBD'})`);
    }
  }

  console.log(`\n  Key Facts: ${contextAfter?.key_facts?.length || 0}`);
  if (contextAfter?.key_facts?.length > 0) {
    console.log('  Recent facts:');
    for (const f of contextAfter.key_facts.slice(-3)) {
      console.log(`    - ${f.fact}`);
    }
  }

  console.log(`\n  Metrics:`);
  console.log(`    Total Interactions: ${metricsAfter?.total_interactions || 0} (was ${metricsBefore?.total_interactions || 0})`);
  console.log(`    Last Contact Date: ${metricsAfter?.last_contact_date?.split('T')[0] || 'N/A'}`);
  console.log(`    Days in Relationship: ${metricsAfter?.days_in_relationship || 0}`);

  console.log(`\n  Summary: ${afterRI.relationship_summary || '(none)'}`);
  if (result.changes.summaryRegenerated) {
    console.log('  ⚡ Summary was regenerated by AI');
  }

  // Step 5: Verification
  console.log('\n─'.repeat(70));
  console.log('✅ VERIFICATION:');
  console.log('─'.repeat(50));

  const checks = [
    {
      name: 'New interaction added',
      passed: interactionsAfter.length > interactionsBefore.length,
      expected: interactionsBefore.length + 1,
      actual: interactionsAfter.length,
    },
    {
      name: 'Buying signals added',
      passed: result.changes.buyingSignalsAdded > 0,
      expected: simulatedAnalysis.buying_signals?.length || 0,
      actual: result.changes.buyingSignalsAdded,
    },
    {
      name: 'Concerns added',
      passed: result.changes.concernsAdded > 0,
      expected: simulatedAnalysis.concerns?.length || 0,
      actual: result.changes.concernsAdded,
    },
    {
      name: 'Their commitments added',
      passed: result.changes.theirCommitmentsAdded > 0,
      expected: simulatedAnalysis.commitments_received?.length || 0,
      actual: result.changes.theirCommitmentsAdded,
    },
    {
      name: 'Key facts added',
      passed: result.changes.keyFactsAdded > 0,
      expected: simulatedAnalysis.key_facts_learned?.length || 0,
      actual: result.changes.keyFactsAdded,
    },
    {
      name: 'Metrics updated',
      passed:
        (metricsAfter?.total_interactions || 0) > (metricsBefore?.total_interactions || 0),
      expected: 'total_interactions incremented',
      actual: `${metricsBefore?.total_interactions || 0} -> ${metricsAfter?.total_interactions || 0}`,
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    const status = check.passed ? '✓' : '✗';
    console.log(`  ${status} ${check.name}: expected ${check.expected}, got ${check.actual}`);
    if (!check.passed) allPassed = false;
  }

  console.log('\n' + '='.repeat(70));
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED - Unified relationship updates working correctly!');
  } else {
    console.log('⚠️ SOME CHECKS FAILED - Review the results above');
  }
  console.log('='.repeat(70));
}

main().catch(console.error);
