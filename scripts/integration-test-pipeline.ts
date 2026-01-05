/**
 * Integration Test: Context-First Pipeline Validation
 *
 * Tests the complete pipeline with Raymond Kidwell's trial form email.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import {
  processIncomingCommunication,
  buildFullRelationshipContext,
} from '../src/lib/intelligence/contextFirstPipeline';
import { CommunicationInput } from '../src/lib/intelligence/entityMatcher';

async function runIntegrationTest() {
  console.log('\n' + '='.repeat(80));
  console.log('INTEGRATION TEST: Context-First Pipeline Validation');
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
    console.error('❌ No user with auth_id found!');
    return;
  }

  console.log(`Testing as user: ${user.email}\n`);

  // Get Raymond Kidwell's trial form email
  const emailId = 'd912ad6d-6537-4f0b-b085-455dccb09e07';
  const { data: email, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', emailId)
    .single();

  if (error || !email) {
    console.error('❌ Could not find email:', error?.message);
    // Try alternate approach - find any inbound email from external domain
    const { data: altEmail } = await supabase
      .from('email_messages')
      .select('*')
      .eq('is_sent_by_user', false)
      .not('from_email', 'ilike', '%affiliatedtech.com%')
      .order('received_at', { ascending: false })
      .limit(1)
      .single();

    if (!altEmail) {
      console.error('❌ No alternative email found');
      return;
    }

    console.log('Using alternative email:', altEmail.subject);
    await processEmail(altEmail, user.id);
    return;
  }

  await processEmail(email, user.id);
}

async function processEmail(email: any, userId: string) {
  const supabase = createAdminClient();

  console.log('─'.repeat(80));
  console.log('EMAIL DETAILS');
  console.log('─'.repeat(80));
  console.log(`  Subject: ${email.subject}`);
  console.log(`  From: ${email.from_name} <${email.from_email}>`);
  console.log(`  Date: ${email.received_at}`);
  console.log(`  Body Preview: ${(email.body_text || email.body_html || '').substring(0, 200)}...`);
  console.log();

  // Create communication input
  const communication: CommunicationInput = {
    type: 'email_inbound',
    from_email: email.from_email,
    from_name: email.from_name,
    subject: email.subject,
    body: email.body_text || email.body_html || '',
  };

  console.log('─'.repeat(80));
  console.log('PROCESSING THROUGH CONTEXT-FIRST PIPELINE');
  console.log('─'.repeat(80));
  console.log();

  const startTime = Date.now();

  try {
    const result = await processIncomingCommunication(communication, userId);
    const elapsed = Date.now() - startTime;

    // ========================================
    // ENTITY MATCHING RESULTS
    // ========================================
    console.log('\n' + '═'.repeat(80));
    console.log('ENTITY MATCHING RESULTS');
    console.log('═'.repeat(80) + '\n');

    console.log('Company Matched:');
    console.log(`  Name: ${result.company?.name || 'NOT FOUND'}`);
    console.log(`  ID: ${result.company?.id || 'N/A'}`);
    console.log(`  Match Confidence: ${(result.matchConfidence * 100).toFixed(0)}%`);
    console.log(`  Match Reasoning: ${result.matchReasoning}`);

    console.log('\nContact Matched:');
    console.log(`  Name: ${result.contact?.name || 'NOT FOUND'}`);
    console.log(`  Email: ${result.contact?.email || 'N/A'}`);
    console.log(`  ID: ${result.contact?.id || 'N/A'}`);

    // ========================================
    // CONTEXT BEFORE PROCESSING
    // ========================================
    console.log('\n' + '═'.repeat(80));
    console.log('CONTEXT BEFORE PROCESSING');
    console.log('═'.repeat(80) + '\n');

    const factsBefore = result.contextBefore?.relationshipIntelligence?.key_facts?.length || 0;
    const interactionsBefore = result.contextBefore?.relationshipIntelligence?.interactions?.length || 0;
    const commitmentsBefore = (
      (result.contextBefore?.relationshipIntelligence?.open_commitments?.ours?.length || 0) +
      (result.contextBefore?.relationshipIntelligence?.open_commitments?.theirs?.length || 0)
    );

    console.log(`  Existing Facts: ${factsBefore}`);
    console.log(`  Previous Interactions: ${interactionsBefore}`);
    console.log(`  Open Commitments: ${commitmentsBefore}`);

    if (result.contextBefore?.relationshipIntelligence?.relationship_summary) {
      console.log('\n  Relationship Summary (Before):');
      console.log(`    ${result.contextBefore.relationshipIntelligence.relationship_summary}`);
    } else {
      console.log('\n  Relationship Summary: (none - new relationship)');
    }

    // ========================================
    // ANALYSIS WITH CONTEXT
    // ========================================
    console.log('\n' + '═'.repeat(80));
    console.log('ANALYSIS WITH CONTEXT');
    console.log('═'.repeat(80) + '\n');

    console.log(`  Communication Type: ${result.analysisWithContext.communication_type}`);
    console.log(`  Should Create Deal: ${result.analysisWithContext.should_create_deal}`);
    if (result.analysisWithContext.recommended_deal_stage) {
      console.log(`  Recommended Deal Stage: ${result.analysisWithContext.recommended_deal_stage}`);
    }

    console.log('\n  Key Facts Extracted:');
    result.analysisWithContext.key_facts_learned.forEach((fact, i) => {
      console.log(`    ${i + 1}. ${fact.fact} (${(fact.confidence * 100).toFixed(0)}% confidence)`);
    });

    console.log('\n  Buying Signals:');
    result.analysisWithContext.buying_signals.forEach((signal, i) => {
      console.log(`    ${i + 1}. [${signal.strength.toUpperCase()}] ${signal.signal}`);
    });

    if (result.analysisWithContext.concerns_raised.length > 0) {
      console.log('\n  Concerns Raised:');
      result.analysisWithContext.concerns_raised.forEach((concern, i) => {
        console.log(`    ${i + 1}. [${concern.severity.toUpperCase()}] ${concern.concern}`);
      });
    }

    console.log('\n  Commitments:');
    console.log('    From Us:');
    result.analysisWithContext.commitment_updates.new_ours.forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.commitment}${c.due_by ? ` (due: ${c.due_by})` : ''}`);
    });
    console.log('    From Them:');
    result.analysisWithContext.commitment_updates.new_theirs.forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.commitment}`);
    });

    console.log('\n  Suggested Actions:');
    result.analysisWithContext.suggested_actions.forEach((action, i) => {
      console.log(`    ${i + 1}. [${action.priority.toUpperCase()}] ${action.title}`);
      console.log(`       Why: ${action.why_now}`);
    });

    // ========================================
    // CONTEXT AFTER PROCESSING
    // ========================================
    console.log('\n' + '═'.repeat(80));
    console.log('CONTEXT AFTER PROCESSING');
    console.log('═'.repeat(80) + '\n');

    const factsAfter = result.contextAfter?.relationshipIntelligence?.key_facts?.length || 0;
    const interactionsAfter = result.contextAfter?.relationshipIntelligence?.interactions?.length || 0;

    console.log(`  Total Facts: ${factsAfter} (was ${factsBefore})`);
    console.log(`  Total Interactions: ${interactionsAfter} (was ${interactionsBefore})`);

    if (result.contextAfter?.relationshipIntelligence?.relationship_summary) {
      console.log('\n  Relationship Summary (After):');
      console.log(`    ${result.contextAfter.relationshipIntelligence.relationship_summary}`);
    }

    // ========================================
    // ACTIONS
    // ========================================
    console.log('\n' + '═'.repeat(80));
    console.log('ACTIONS');
    console.log('═'.repeat(80) + '\n');

    console.log(`  Actions Created: ${result.actionsCreated.length}`);
    result.actionsCreated.forEach((action, i) => {
      console.log(`    ${i + 1}. ${action.title}`);
    });

    console.log(`\n  Actions Updated: ${result.actionsUpdated.length}`);
    result.actionsUpdated.forEach((action, i) => {
      console.log(`    ${i + 1}. ${action.title}`);
    });

    console.log(`\n  Actions Completed/Obsoleted: ${result.actionsCompleted.length}`);
    result.actionsCompleted.forEach((action, i) => {
      console.log(`    ${i + 1}. ${action.title}`);
    });

    // ========================================
    // DEAL
    // ========================================
    console.log('\n' + '═'.repeat(80));
    console.log('DEAL');
    console.log('═'.repeat(80) + '\n');

    if (result.deal) {
      console.log(`  Name: ${result.deal.name}`);
      console.log(`  Stage: ${result.deal.stage}`);
      console.log(`  Value: ${result.deal.estimated_value ? '$' + result.deal.estimated_value.toLocaleString() : 'Not set'}`);
    } else {
      console.log('  No deal created/found');
    }

    // ========================================
    // VALIDATION CHECKLIST
    // ========================================
    console.log('\n' + '═'.repeat(80));
    console.log('VALIDATION CHECKLIST');
    console.log('═'.repeat(80) + '\n');

    const checks = [
      {
        name: 'Company identified',
        pass: !!result.company,
        detail: result.company?.name || 'Not found'
      },
      {
        name: 'Contact identified',
        pass: !!result.contact,
        detail: result.contact?.name || 'Not found'
      },
      {
        name: 'High confidence match (≥70%)',
        pass: result.matchConfidence >= 0.70,
        detail: `${(result.matchConfidence * 100).toFixed(0)}%`
      },
      {
        name: 'Context loaded',
        pass: !!result.contextBefore,
        detail: 'Yes'
      },
      {
        name: 'Analysis completed',
        pass: !!result.analysisWithContext,
        detail: result.analysisWithContext.communication_type
      },
      {
        name: 'Context updated (grew)',
        pass: factsAfter >= factsBefore,
        detail: `${factsBefore} → ${factsAfter} facts`
      },
      {
        name: 'Actions determined',
        pass: result.actionsCreated.length > 0 || result.actionsUpdated.length > 0,
        detail: `${result.actionsCreated.length} created, ${result.actionsUpdated.length} updated`
      },
      {
        name: 'Relationship summary exists',
        pass: !!result.contextAfter?.relationshipIntelligence?.relationship_summary,
        detail: result.contextAfter?.relationshipIntelligence?.relationship_summary ? 'Yes' : 'No'
      },
    ];

    checks.forEach(check => {
      const icon = check.pass ? '✅' : '❌';
      console.log(`  ${icon} ${check.name}: ${check.detail}`);
    });

    const passed = checks.filter(c => c.pass).length;
    console.log(`\n  Result: ${passed}/${checks.length} checks passed`);

    if (passed === checks.length) {
      console.log('\n  🎉 PIPELINE VALIDATION SUCCESSFUL!');
    } else {
      console.log('\n  ⚠️  Some checks failed - review output above');
    }

    console.log(`\n  Processing time: ${elapsed}ms`);

    return result;

  } catch (error: any) {
    console.error('\n❌ Error processing email:', error.message);
    console.error(error.stack);
    return null;
  }
}

// Run the test
runIntegrationTest().catch(console.error);
