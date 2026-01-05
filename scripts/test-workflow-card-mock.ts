/**
 * Test Workflow Card Creation (Mock Test)
 *
 * Tests the workflow card creation logic without needing AI analysis.
 * Creates a mock workflow card directly to verify the database and UI work.
 *
 * Run with: npx tsx scripts/test-workflow-card-mock.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  console.log('='.repeat(80));
  console.log('WORKFLOW CARD MOCK TEST');
  console.log('='.repeat(80));

  const supabase = createAdminClient();

  // Get the user ID (first user)
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();

  if (!user) {
    console.log('No user found!');
    return;
  }

  console.log(`Using user: ${user.id}`);

  // Create a mock workflow card
  console.log('\n--- Creating mock workflow card ---\n');

  const workflowSteps = [
    {
      id: 'step-1-' + Date.now(),
      title: 'Set up X-RAI trial for Lawn Doctor (16 agents)',
      owner: 'operations',
      urgency: 'critical',
      completed: false,
      completed_at: null,
    },
    {
      id: 'step-2-' + Date.now(),
      title: 'Schedule trial review call with Andrew Canniff',
      owner: 'sales_rep',
      urgency: 'high',
      completed: false,
      completed_at: null,
    },
    {
      id: 'step-3-' + Date.now(),
      title: 'Forward signed trial form to operations for immediate setup',
      owner: 'sales_rep',
      urgency: 'high',
      completed: false,
      completed_at: null,
    },
  ];

  const mockCard = {
    user_id: user.id,
    title: 'Process Trial Form Submission - Lawn Doctor',
    description: 'Complete all steps to process this free trial form from Andrew Canniff at Lawn Doctor.',
    tier: 1,
    tier_trigger: 'free_trial_form',
    why_now: 'Signed trial form received from Andrew Canniff at Lawn Doctor (16 agents) — ready for immediate setup.',
    action_type: 'workflow',
    status: 'pending',
    source: 'ai_recommendation',
    source_hash: 'mock-test-' + Date.now(),
    workflow_steps: workflowSteps,
    momentum_score: 95,
    estimated_minutes: 30,
    created_at: new Date().toISOString(),
  };

  const { data: createdItem, error } = await supabase
    .from('command_center_items')
    .insert(mockCard)
    .select()
    .single();

  if (error) {
    console.error('Error creating workflow card:', error);
    return;
  }

  console.log('Created workflow card!');
  console.log(`  ID: ${createdItem.id}`);
  console.log(`  Title: ${createdItem.title}`);
  console.log(`  Tier: ${createdItem.tier}`);
  console.log(`  Action Type: ${createdItem.action_type}`);
  console.log(`  Source Hash: ${createdItem.source_hash}`);

  console.log('\n  Workflow Steps:');
  const steps = createdItem.workflow_steps as any[];
  steps.forEach((step, i) => {
    const status = step.completed ? '✓' : '○';
    console.log(`    ${status} ${i + 1}. ${step.title} [${step.owner}]`);
  });

  // Test step completion
  console.log('\n--- Testing step completion ---\n');

  // Complete the first step
  const updatedSteps = [...steps];
  updatedSteps[0].completed = true;
  updatedSteps[0].completed_at = new Date().toISOString();

  const { data: updatedItem, error: updateError } = await supabase
    .from('command_center_items')
    .update({ workflow_steps: updatedSteps })
    .eq('id', createdItem.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error completing step:', updateError);
    return;
  }

  console.log('Completed first step!');
  const updatedStepsResult = updatedItem.workflow_steps as any[];
  updatedStepsResult.forEach((step, i) => {
    const status = step.completed ? '✓' : '○';
    console.log(`  ${status} ${i + 1}. ${step.title}`);
    if (step.completed_at) {
      console.log(`     Completed at: ${step.completed_at}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('MOCK TEST COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nView in browser: Open the Command Center to see the workflow card.`);
  console.log(`Card ID: ${createdItem.id}`);
}

main().catch(console.error);
