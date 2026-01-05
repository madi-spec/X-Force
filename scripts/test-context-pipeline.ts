/**
 * Test Context-First Processing Pipeline
 *
 * Tests the full pipeline with the Lawn Doctor trial form email.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import {
  processIncomingCommunication,
  buildFullRelationshipContext,
} from '../src/lib/intelligence/contextFirstPipeline';
import { CommunicationInput } from '../src/lib/intelligence/entityMatcher';

async function testTrialFormEmail() {
  console.log('='.repeat(80));
  console.log('CONTEXT-FIRST PIPELINE TEST: Trial Form Email');
  console.log('='.repeat(80));
  console.log();

  const supabase = createAdminClient();

  // Get a user with auth_id
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .not('auth_id', 'is', null)
    .limit(1)
    .single();

  if (!user) {
    console.log('No user with auth_id found!');
    return;
  }

  console.log(`Testing as user: ${user.email}`);
  console.log();

  // Create a trial form email
  const trialFormEmail: CommunicationInput = {
    type: 'email_inbound',
    from_email: 'acanniff@lawndoctorma.com',
    from_name: 'Andrew Canniff',
    subject: 'X-RAI Trial Authorization Form - Lawn Doctor of Hanover',
    body: [
      'Trial Authorization Form Submission',
      '',
      'Company: Lawn Doctor of Hanover',
      'Contact: Andrew Canniff',
      'Title: VP/GM',
      'Email: acanniff@lawndoctorma.com',
      'Phone: 781-831-2165',
      '',
      'Team Size: 16 agents',
      'Location: Hanover, MA',
      'Type: Franchisee',
      '',
      'Primary Use Case: Customer service call recording and analysis',
      'Integration Needed: FieldRoutes (CRM)',
      '',
      'I authorize X-RAI to process our call recordings for the trial period.',
      '',
      'Best regards,',
      'Andy Canniff',
      'VP/GM',
      'Lawn Doctor of Hanover',
    ].join('\n'),
  };

  console.log('INPUT:');
  console.log(`  From: ${trialFormEmail.from_name} <${trialFormEmail.from_email}>`);
  console.log(`  Subject: ${trialFormEmail.subject}`);
  console.log();

  console.log('Processing through context-first pipeline...');
  console.log();

  const startTime = Date.now();
  try {
    const result = await processIncomingCommunication(trialFormEmail, user.id);
    const elapsed = Date.now() - startTime;

    console.log('─'.repeat(80));
    console.log('RESULT:');
    console.log('─'.repeat(80));
    console.log();

    console.log('ENTITY MATCHING:');
    console.log(`  Company: ${result.company?.name || 'NONE'}`);
    console.log(`  Contact: ${result.contact?.name || 'NONE'}`);
    console.log(`  Match Confidence: ${(result.matchConfidence * 100).toFixed(0)}%`);
    console.log(`  Match Reasoning: ${result.matchReasoning}`);
    console.log();

    console.log('DEAL:');
    if (result.deal) {
      console.log(`  Name: ${result.deal.name}`);
      console.log(`  Stage: ${result.deal.stage}`);
      console.log(`  Value: ${result.deal.estimated_value ? '$' + result.deal.estimated_value.toLocaleString() : 'Not set'}`);
    } else {
      console.log('  No deal created/found');
    }
    console.log();

    console.log('ANALYSIS:');
    console.log(`  Communication Type: ${result.analysisWithContext.communication_type}`);
    console.log(`  Should Create Deal: ${result.analysisWithContext.should_create_deal}`);
    console.log();

    console.log('KEY FACTS LEARNED:');
    result.analysisWithContext.key_facts_learned.forEach(f => {
      console.log(`  - ${f.fact} (confidence: ${(f.confidence * 100).toFixed(0)}%)`);
    });
    console.log();

    console.log('BUYING SIGNALS:');
    result.analysisWithContext.buying_signals.forEach(s => {
      console.log(`  - [${s.strength.toUpperCase()}] ${s.signal}`);
    });
    console.log();

    console.log('COMMITMENTS:');
    console.log('  New from us:');
    result.analysisWithContext.commitment_updates.new_ours.forEach(c => {
      console.log(`    - ${c.commitment}${c.due_by ? ` (due: ${c.due_by})` : ''}`);
    });
    console.log('  New from them:');
    result.analysisWithContext.commitment_updates.new_theirs.forEach(c => {
      console.log(`    - ${c.commitment}`);
    });
    console.log();

    console.log('ACTIONS:');
    console.log('  Created:');
    result.actionsCreated.forEach(a => {
      console.log(`    - ${a.title}`);
    });
    if (result.actionsCompleted.length > 0) {
      console.log('  Completed:');
      result.actionsCompleted.forEach(a => {
        console.log(`    - ${a.title}`);
      });
    }
    console.log();

    console.log('RELATIONSHIP SUMMARY UPDATE:');
    console.log(`  ${result.analysisWithContext.relationship_summary_update}`);
    console.log();

    console.log(`Processing time: ${elapsed}ms`);

    return result;
  } catch (error) {
    console.error('Error processing:', error);
    return null;
  }
}

async function testFollowUpEmail() {
  console.log();
  console.log('='.repeat(80));
  console.log('CONTEXT-FIRST PIPELINE TEST: Follow-up Email');
  console.log('='.repeat(80));
  console.log();

  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .not('auth_id', 'is', null)
    .limit(1)
    .single();

  if (!user) return;

  // Check existing context first
  console.log('Loading existing context for Lawn Doctor of Hanover...');
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%Lawn Doctor of Hanover%')
    .single();

  if (company) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('company_id', company.id)
      .ilike('name', '%Canniff%')
      .single();

    if (contact) {
      const context = await buildFullRelationshipContext({
        companyId: company.id,
        contactId: contact.id,
      });

      console.log();
      console.log('EXISTING CONTEXT:');
      console.log(`  Relationship Summary: ${context.relationshipIntelligence?.relationship_summary || 'None'}`);
      console.log(`  Key Facts: ${context.relationshipIntelligence?.key_facts?.length || 0}`);
      console.log(`  Interactions: ${context.relationshipIntelligence?.interactions?.length || 0}`);
      console.log(`  Open Commitments (ours): ${context.relationshipIntelligence?.open_commitments?.ours?.length || 0}`);
      console.log();
    }
  }

  // Simulate a follow-up email asking about trial status
  const followUpEmail: CommunicationInput = {
    type: 'email_inbound',
    from_email: 'acanniff@lawndoctorma.com',
    from_name: 'Andy Canniff',
    subject: 'Re: X-RAI Trial Authorization Form - Lawn Doctor of Hanover',
    body: [
      'Hi,',
      '',
      'Just checking in on the trial setup. When can we expect to have access?',
      '',
      'Also, a quick question - will the system integrate with our existing FieldRoutes',
      'call logging or is it a separate dashboard?',
      '',
      'Thanks,',
      'Andy',
    ].join('\n'),
  };

  console.log('INPUT:');
  console.log(`  From: ${followUpEmail.from_name} <${followUpEmail.from_email}>`);
  console.log(`  Subject: ${followUpEmail.subject}`);
  console.log();

  console.log('Processing follow-up through context-first pipeline...');
  console.log();

  const startTime = Date.now();
  try {
    const result = await processIncomingCommunication(followUpEmail, user.id);
    const elapsed = Date.now() - startTime;

    console.log('─'.repeat(80));
    console.log('FOLLOW-UP RESULT:');
    console.log('─'.repeat(80));
    console.log();

    console.log('ENTITY MATCHING:');
    console.log(`  Company: ${result.company?.name || 'NONE'}`);
    console.log(`  Contact: ${result.contact?.name || 'NONE'}`);
    console.log(`  Match Confidence: ${(result.matchConfidence * 100).toFixed(0)}%`);
    console.log();

    console.log('ANALYSIS:');
    console.log(`  Communication Type: ${result.analysisWithContext.communication_type}`);
    console.log();

    console.log('NEW KEY FACTS:');
    result.analysisWithContext.key_facts_learned.forEach(f => {
      console.log(`  - ${f.fact}`);
    });
    console.log();

    console.log('CONCERNS RAISED:');
    result.analysisWithContext.concerns_raised.forEach(c => {
      console.log(`  - [${c.severity.toUpperCase()}] ${c.concern}`);
    });
    console.log();

    console.log('ACTIONS CREATED:');
    result.actionsCreated.forEach(a => {
      console.log(`  - ${a.title}`);
    });
    console.log();

    console.log('GROWN CONTEXT:');
    console.log(`  Total interactions: ${result.contextAfter.relationshipIntelligence?.interactions?.length || 0}`);
    console.log(`  Total key facts: ${result.contextAfter.relationshipIntelligence?.key_facts?.length || 0}`);
    console.log();

    console.log(`Processing time: ${elapsed}ms`);
  } catch (error) {
    console.error('Error processing:', error);
  }
}

async function main() {
  // Test 1: Process trial form email
  await testTrialFormEmail();

  // Test 2: Process follow-up email (context should have grown)
  await testFollowUpEmail();

  console.log();
  console.log('='.repeat(80));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
