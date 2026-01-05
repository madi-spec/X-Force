/**
 * Test Script: Playbook-Informed Analysis
 *
 * Tests the intelligent sales analysis system with inbound emails.
 *
 * Run with: npx tsx scripts/test-playbook-analysis.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import { processInboundEmail } from '../src/lib/intelligence/analyzeInboundEmail';
import { getOpenItemsForContact } from '../src/lib/intelligence/reconcileActions';

async function main() {
  console.log('='.repeat(80));
  console.log('INTELLIGENT SALES ANALYSIS SYSTEM TEST');
  console.log('='.repeat(80));

  const supabase = createAdminClient();

  // Step 1: Find Raymond Kidwell or trial form email
  console.log('\n--- Step 1: Finding test email ---\n');

  // First try to find Raymond Kidwell
  const { data: kidwellMessages } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, body_preview, received_at')
    .or('from_email.ilike.%kidwell%,body_preview.ilike.%kidwell%')
    .order('received_at', { ascending: false })
    .limit(5);

  if (kidwellMessages?.length) {
    console.log('Found Kidwell-related emails:');
    kidwellMessages.forEach(e => {
      console.log(`  - [${e.id}] ${e.subject}`);
      console.log(`    From: ${e.from_email}`);
      console.log(`    Date: ${e.received_at}`);
    });
  }

  // Also search for trial form emails
  const { data: trialFormEmails } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, body_preview, received_at')
    .or('body_preview.ilike.%trial authorization%,body_preview.ilike.%free trial%,body_preview.ilike.%e-signature%,subject.ilike.%trial%')
    .order('received_at', { ascending: false })
    .limit(5);

  if (trialFormEmails?.length) {
    console.log('\nFound trial-related emails:');
    trialFormEmails.forEach(e => {
      console.log(`  - [${e.id}] ${e.subject}`);
      console.log(`    From: ${e.from_email}`);
      console.log(`    Preview: ${e.body_preview?.substring(0, 100)}...`);
    });
  }

  // Use Raymond Kidwell trial form email for testing
  // d912ad6d-6537-4f0b-b085-455dccb09e07 - "Fw: x-rai free trial form VFP"
  const testEmailId = kidwellMessages?.find(e => e.subject?.toLowerCase().includes('trial form'))?.id
    || kidwellMessages?.[0]?.id
    || 'd912ad6d-6537-4f0b-b085-455dccb09e07';
  console.log(`\n--- Testing with email ID: ${testEmailId} ---\n`);

  // Force reanalysis by clearing the analysis_complete flag
  const forceReanalysis = process.argv.includes('--force');
  if (forceReanalysis) {
    console.log('Forcing reanalysis by clearing analysis_complete flag...');
    await supabase
      .from('email_messages')
      .update({ analysis_complete: false, ai_analysis: null })
      .eq('id', testEmailId);
  }

  // Step 2: Run the playbook-informed analysis
  console.log('Running playbook-informed analysis...\n');

  try {
    const result = await processInboundEmail(testEmailId);

    if (!result.success) {
      console.log('Analysis failed:', result.error);
      return;
    }

    console.log('='.repeat(60));
    console.log('ANALYSIS RESULT');
    console.log('='.repeat(60));

    const analysis = result.analysis!;

    console.log(`\nSUMMARY: ${analysis.summary}`);

    console.log('\n--- Classification ---');
    console.log(`Communication Type: ${analysis.communication_type}`);
    console.log(`  Reasoning: ${analysis.communication_type_reasoning}`);
    console.log(`Sales Stage: ${analysis.sales_stage}`);
    console.log(`Workflow Type: ${analysis.workflow_type}`);

    console.log('\n--- Priority ---');
    if (analysis.command_center_classification) {
      console.log(`Tier: ${analysis.command_center_classification.tier}`);
      console.log(`Trigger: ${analysis.command_center_classification.tier_trigger}`);
      console.log(`SLA: ${analysis.command_center_classification.sla_minutes} minutes`);
      console.log(`Why Now: ${analysis.command_center_classification.why_now}`);
    }

    console.log('\n--- Key Observations ---');
    if (analysis.key_observations?.buying_signals?.length) {
      console.log('Buying Signals:');
      analysis.key_observations.buying_signals.forEach(s => {
        console.log(`  - [${s.strength}] ${s.signal}`);
        if (s.quote) console.log(`    Quote: "${s.quote}"`);
      });
    }
    if (analysis.key_observations?.risk_signals?.length) {
      console.log('Risk Signals:');
      analysis.key_observations.risk_signals.forEach(s => {
        console.log(`  - ${s.signal}`);
      });
    }
    if (analysis.key_observations?.urgency_indicators?.length) {
      console.log('Urgency Indicators:');
      analysis.key_observations.urgency_indicators.forEach(s => {
        console.log(`  - ${s.indicator}`);
      });
    }

    console.log('\n--- Required Actions ---');
    if (analysis.required_actions?.length) {
      analysis.required_actions.forEach(a => {
        console.log(`  [${a.urgency.toUpperCase()}] ${a.action}`);
        console.log(`    Owner: ${a.owner}`);
        console.log(`    Reason: ${a.reasoning}`);
      });
    } else {
      console.log('  No required actions identified');
    }

    console.log('\n--- Relationship Impact ---');
    if (analysis.relationship_progression) {
      console.log(`Momentum: ${analysis.relationship_progression.momentum}`);
      console.log(`Assessment: ${analysis.relationship_progression.assessment}`);
    }

    // Show reconciliation results if available
    if (result.reconciliation) {
      console.log('\n' + '='.repeat(60));
      console.log('RECONCILIATION RESULT');
      console.log('='.repeat(60));

      console.log(`\nReasoning: ${result.reconciliation.reasoning}`);
      console.log(`Summary: ${result.reconciliation.summary}`);

      if (result.reconciliation.existing_items?.length) {
        console.log('\n--- Decisions for Existing Items ---');
        result.reconciliation.existing_items.forEach(item => {
          console.log(`  [${item.decision.toUpperCase()}] ${item.id.substring(0, 8)}...`);
          console.log(`    Reason: ${item.reason}`);
        });
      }

      if (result.reconciliation.new_items?.length) {
        console.log('\n--- New Items Created ---');
        result.reconciliation.new_items.forEach(item => {
          console.log(`  [Tier ${item.tier}] ${item.title}`);
          console.log(`    Trigger: ${item.tier_trigger}`);
          console.log(`    Owner: ${item.owner}`);
        });
      }
    }

    // Show applied stats
    if (result.reconciliationStats) {
      console.log('\n--- Applied Changes ---');
      console.log(`  Completed: ${result.reconciliationStats.completed}`);
      console.log(`  Updated: ${result.reconciliationStats.updated}`);
      console.log(`  Combined: ${result.reconciliationStats.combined}`);
      console.log(`  Created: ${result.reconciliationStats.created}`);
    }

    // Show auto-link results
    if (result.autoLink) {
      console.log('\n' + '='.repeat(60));
      console.log('AUTO-LINK RESULT');
      console.log('='.repeat(60));

      console.log(`\nContact ID: ${result.autoLink.contact_id}`);
      console.log(`Company ID: ${result.autoLink.company_id}`);
      console.log(`Deal ID: ${result.autoLink.deal_id}`);

      console.log('\n--- Matching ---');
      console.log(`  Contact: ${result.autoLink.matched.contact}`);
      console.log(`  Company: ${result.autoLink.matched.company}`);
      console.log(`  Deal: ${result.autoLink.matched.deal}`);

      console.log('\n--- Created ---');
      console.log(`  Contact: ${result.autoLink.created.contact}`);
      console.log(`  Company: ${result.autoLink.created.company}`);
      console.log(`  Deal: ${result.autoLink.created.deal}`);
    }

    // Verify command center items are linked
    console.log('\n' + '='.repeat(60));
    console.log('VERIFYING COMMAND CENTER ITEMS');
    console.log('='.repeat(60));

    const { data: items } = await supabase
      .from('command_center_items')
      .select('id, title, contact_id, company_id, deal_id, tier')
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (items?.length) {
      console.log('\nRecent command center items:');
      items.forEach(item => {
        const linked = item.contact_id || item.company_id || item.deal_id ? '✓' : '✗';
        console.log(`  [${linked}] Tier ${item.tier}: ${item.title.substring(0, 50)}...`);
        if (item.company_id) console.log(`      Company: ${item.company_id.substring(0, 8)}...`);
        if (item.contact_id) console.log(`      Contact: ${item.contact_id.substring(0, 8)}...`);
        if (item.deal_id) console.log(`      Deal: ${item.deal_id.substring(0, 8)}...`);
      });
    }

  } catch (error) {
    console.error('Error during analysis:', error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
