/**
 * Test Workflow Card Creation
 *
 * 1. Finds the Raymond Kidwell trial form email
 * 2. Deletes existing command center items for that contact
 * 3. Re-runs analysis to create a workflow card
 * 4. Shows the result
 *
 * Run with: npx tsx scripts/test-workflow-card.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import { processInboundEmail } from '../src/lib/intelligence/analyzeInboundEmail';

async function main() {
  console.log('='.repeat(80));
  console.log('WORKFLOW CARD TEST');
  console.log('='.repeat(80));

  const supabase = createAdminClient();

  // Step 1: Find the trial form email
  console.log('\n--- Step 1: Finding trial form email ---\n');

  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, from_name, received_at')
    .or('subject.ilike.%x-rai free trial form%,subject.ilike.%trial form VFP%')
    .order('received_at', { ascending: false })
    .limit(5);

  if (!emails?.length) {
    console.log('No trial form emails found!');
    return;
  }

  console.log('Found trial form emails:');
  emails.forEach(e => {
    console.log(`  [${e.id}] ${e.subject}`);
    console.log(`    From: ${e.from_email} (${e.from_name})`);
    console.log(`    Date: ${e.received_at}`);
  });

  // Use the Raymond Kidwell one (contains VFP)
  const testEmail = emails.find(e => e.subject?.includes('VFP')) || emails[0];
  console.log(`\nUsing email: ${testEmail.id}`);

  // Step 2: Find contact from email sender
  console.log('\n--- Step 2: Finding contact ---\n');

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, email, company_id')
    .eq('email', testEmail.from_email)
    .single();

  if (contact) {
    console.log(`Found contact: ${contact.name} (${contact.email})`);
    console.log(`  Contact ID: ${contact.id}`);
    console.log(`  Company ID: ${contact.company_id}`);
  } else {
    console.log('No matching contact found');
  }

  // Step 3: Delete existing items for this email/contact
  console.log('\n--- Step 3: Cleaning up existing items ---\n');

  // Find items linked to this email or contact
  let deleteQuery = supabase
    .from('command_center_items')
    .select('id, title, tier, status')
    .in('status', ['pending', 'in_progress']);

  if (contact) {
    deleteQuery = deleteQuery.eq('contact_id', contact.id);
  }

  const { data: existingItems } = await deleteQuery;

  if (existingItems?.length) {
    console.log(`Found ${existingItems.length} existing items to clean up:`);
    existingItems.forEach(item => {
      console.log(`  [T${item.tier}] ${item.title.substring(0, 50)}...`);
    });

    // Delete them
    const ids = existingItems.map(i => i.id);
    const { error: deleteError } = await supabase
      .from('command_center_items')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Error deleting items:', deleteError);
    } else {
      console.log(`Deleted ${ids.length} items.`);
    }
  } else {
    console.log('No existing items to clean up.');
  }

  // Reset email analysis flag
  await supabase
    .from('email_messages')
    .update({ analysis_complete: false, ai_analysis: null })
    .eq('id', testEmail.id);

  console.log('Reset email analysis flag.');

  // Step 4: Re-run analysis
  console.log('\n--- Step 4: Running analysis ---\n');

  try {
    const result = await processInboundEmail(testEmail.id);

    if (!result.success) {
      console.log('Analysis failed:', result.error);
      return;
    }

    console.log('Analysis complete!');
    console.log(`  Communication Type: ${result.analysis?.communication_type}`);
    console.log(`  Sales Stage: ${result.analysis?.sales_stage}`);
    console.log(`  Required Actions: ${result.analysis?.required_actions?.length || 0}`);

    if (result.analysis?.required_actions?.length) {
      console.log('\n  Actions identified:');
      result.analysis.required_actions.forEach((a, i) => {
        console.log(`    ${i + 1}. [${a.urgency}] ${a.action}`);
        console.log(`       Owner: ${a.owner}`);
      });
    }

    console.log(`\n  Reconciliation: ${result.reconciliation?.summary}`);
    console.log(`  Stats: ${JSON.stringify(result.reconciliationStats)}`);

  } catch (error) {
    console.error('Error during analysis:', error);
    return;
  }

  // Step 5: Show the created workflow card
  console.log('\n--- Step 5: Checking created items ---\n');

  const { data: newItems } = await supabase
    .from('command_center_items')
    .select('id, title, tier, tier_trigger, why_now, workflow_steps, source_hash, email_id, action_type')
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (newItems?.length) {
    console.log('Created command center items:');
    newItems.forEach(item => {
      console.log(`\n  [T${item.tier}] ${item.title}`);
      console.log(`    Trigger: ${item.tier_trigger}`);
      console.log(`    Action Type: ${item.action_type}`);
      console.log(`    Source Hash: ${item.source_hash?.substring(0, 16)}...`);
      console.log(`    Email ID: ${item.email_id}`);

      if (item.workflow_steps && Array.isArray(item.workflow_steps)) {
        console.log(`    Workflow Steps (${item.workflow_steps.length}):`);
        item.workflow_steps.forEach((step: any, i: number) => {
          const status = step.completed ? '✓' : '○';
          console.log(`      ${status} ${i + 1}. ${step.title} [${step.owner}]`);
        });
      } else {
        console.log('    Workflow Steps: None (single action)');
      }
    });
  } else {
    console.log('No items created!');
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
