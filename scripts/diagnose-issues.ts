/**
 * Diagnose the critical issues with command center items
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  console.log('=== PROBLEM 3: Checking workflow_steps data ===\n');

  const { data: workflowItems } = await supabase
    .from('command_center_items')
    .select('id, title, workflow_steps')
    .not('workflow_steps', 'is', null)
    .limit(5);

  workflowItems?.forEach((item, i) => {
    console.log(`${i + 1}. ${item.title}`);
    const steps = item.workflow_steps as any[];
    if (steps && steps.length > 0) {
      console.log(`   Steps (${steps.length}):`);
      steps.forEach((step, j) => {
        console.log(`     ${j + 1}. title="${step.title}" owner="${step.owner}"`);
      });
    }
    console.log('');
  });

  console.log('\n=== PROBLEM 2: Items with company names but no link ===\n');

  const { data: unlinked } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, contact_id')
    .is('company_id', null)
    .in('status', ['pending', 'in_progress'])
    .limit(15);

  console.log(`Found ${unlinked?.length || 0} items without company_id:\n`);
  unlinked?.forEach((item, i) => {
    console.log(`${i + 1}. "${item.title}"`);
    console.log(`   company_id: ${item.company_id || 'NULL'}, contact_id: ${item.contact_id || 'NULL'}`);
  });

  // Check if companies exist that match these names
  console.log('\n\n=== Checking if companies exist for unlinked items ===\n');

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .limit(200);

  const companyNames = companies?.map(c => c.name.toLowerCase()) || [];

  for (const item of unlinked || []) {
    const title = item.title.toLowerCase();
    const matchingCompany = companies?.find(c =>
      title.includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes(title.split(':')[0].trim())
    );

    if (matchingCompany) {
      console.log(`MATCH FOUND: "${item.title}"`);
      console.log(`  -> Company: "${matchingCompany.name}" (${matchingCompany.id})`);
    }
  }

  // Check tier distribution
  console.log('\n\n=== Current Tier Distribution ===\n');

  const { data: allItems } = await supabase
    .from('command_center_items')
    .select('tier, tier_trigger')
    .in('status', ['pending', 'in_progress']);

  const tierCounts: Record<number, number> = {};
  const triggerCounts: Record<string, number> = {};

  allItems?.forEach(item => {
    tierCounts[item.tier] = (tierCounts[item.tier] || 0) + 1;
    triggerCounts[item.tier_trigger || 'unknown'] = (triggerCounts[item.tier_trigger || 'unknown'] || 0) + 1;
  });

  console.log('By Tier:');
  Object.entries(tierCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([tier, count]) => {
      console.log(`  Tier ${tier}: ${count}`);
    });

  console.log('\nBy Trigger:');
  Object.entries(triggerCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([trigger, count]) => {
      console.log(`  ${trigger}: ${count}`);
    });
}

main().catch(console.error);
