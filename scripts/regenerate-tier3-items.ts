/**
 * Regenerate Tier 3 Command Center Items
 *
 * Clears existing Tier 3 items and recreates from all pending commitments
 * (not just overdue ones).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';

interface Commitment {
  commitment: string;
  made_on: string;
  due_by?: string;
  status: string;
  interaction_id?: string;
  source_type?: string;
}

async function main() {
  console.log('='.repeat(70));
  console.log('REGENERATE TIER 3 COMMAND CENTER ITEMS');
  console.log('='.repeat(70));

  const now = new Date();

  // Step 1: Count existing Tier 3 items
  console.log('\n--- Step 1: Current State ---\n');

  const { count: existingCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('tier', 3)
    .eq('status', 'pending');

  console.log(`Existing Tier 3 items: ${existingCount}`);

  // Step 2: Clear existing Tier 3 items (source = 'system')
  console.log('\n--- Step 2: Clearing Tier 3 Items ---\n');

  const { error: deleteError, count: deletedCount } = await supabase
    .from('command_center_items')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('tier', 3)
    .eq('source', 'system');

  if (deleteError) {
    console.error('Error deleting:', deleteError.message);
  } else {
    console.log(`Deleted ${deletedCount} system-generated Tier 3 items`);
  }

  // Step 3: Get all RI records with commitments
  console.log('\n--- Step 3: Fetching Relationship Intelligence ---\n');

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, company_id, contact_id, open_commitments')
    .not('open_commitments', 'is', null);

  console.log(`Found ${riRecords?.length || 0} RI records with commitments`);

  // Count total commitments
  let totalCommitments = 0;
  let pendingCommitments = 0;
  let overdueCommitments = 0;

  for (const ri of riRecords || []) {
    const ours = ri.open_commitments?.ours || [];
    totalCommitments += ours.length;
    for (const c of ours) {
      if (c.status === 'pending') {
        pendingCommitments++;
        if (c.due_by && new Date(c.due_by) < now) {
          overdueCommitments++;
        }
      }
    }
  }

  console.log(`Total 'our' commitments: ${totalCommitments}`);
  console.log(`Pending commitments: ${pendingCommitments}`);
  console.log(`Overdue commitments: ${overdueCommitments}`);

  // Step 4: Create Tier 3 items for ALL pending commitments
  console.log('\n--- Step 4: Creating Tier 3 Items ---\n');

  let created = 0;
  const errors: string[] = [];

  for (const ri of riRecords || []) {
    const ours: Commitment[] = ri.open_commitments?.ours || [];
    const pendingOurs = ours.filter(c => c.status === 'pending');

    if (pendingOurs.length === 0) continue;

    // Get company and contact names
    let companyName: string | null = null;
    let contactName: string | null = null;

    if (ri.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', ri.company_id)
        .single();
      companyName = company?.name || null;
    }

    if (ri.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('id', ri.contact_id)
        .single();
      contactName = contact?.name || null;
    }

    const targetName = contactName || companyName || 'Unknown';

    for (const commitment of pendingOurs) {
      const dueBy = commitment.due_by ? new Date(commitment.due_by) : null;
      const madeOn = new Date(commitment.made_on);
      const isOverdue = dueBy && dueBy < now;
      const daysSinceMade = Math.floor((now.getTime() - madeOn.getTime()) / (1000 * 60 * 60 * 24));

      // Generate appropriate why_now based on status
      let whyNow: string;
      if (isOverdue) {
        const daysOverdue = Math.floor((now.getTime() - dueBy.getTime()) / (1000 * 60 * 60 * 24));
        whyNow = `You promised this ${daysOverdue} days ago. ${targetName} is waiting.`;
      } else if (dueBy) {
        const daysUntilDue = Math.floor((dueBy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        whyNow = `Due in ${daysUntilDue} days. You promised ${targetName} on ${madeOn.toLocaleDateString()}.`;
      } else {
        whyNow = `You committed to this ${daysSinceMade} days ago for ${targetName}.`;
      }

      // Create unique identifier for deduplication
      const commitmentSnippet = commitment.commitment.substring(0, 50);

      // Check if similar item exists
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('tier', 3)
        .ilike('commitment_text', `%${commitmentSnippet}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        continue; // Skip duplicate
      }

      // Calculate urgency score
      let urgencyScore = 50; // Base score
      if (isOverdue) {
        const daysOverdue = Math.floor((now.getTime() - dueBy.getTime()) / (1000 * 60 * 60 * 24));
        urgencyScore = Math.min(100, 70 + daysOverdue * 5);
      } else if (dueBy) {
        const daysUntilDue = Math.floor((dueBy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 1) urgencyScore = 85;
        else if (daysUntilDue <= 3) urgencyScore = 70;
        else if (daysUntilDue <= 7) urgencyScore = 60;
      }

      const { error: insertError } = await supabase
        .from('command_center_items')
        .insert({
          user_id: userId,
          company_id: ri.company_id,
          contact_id: ri.contact_id,
          action_type: 'task_complex',
          title: isOverdue
            ? `Overdue: ${commitment.commitment.substring(0, 50)}`
            : `Follow through: ${commitment.commitment.substring(0, 50)}`,
          description: commitment.commitment,
          why_now: whyNow,
          tier: 3,
          tier_trigger: 'promise_made',
          commitment_text: commitment.commitment,
          promise_date: commitment.made_on,
          due_at: dueBy?.toISOString() || null,
          status: 'pending',
          source: 'system',
          target_name: targetName,
          company_name: companyName,
          urgency_score: urgencyScore,
        });

      if (insertError) {
        errors.push(`${targetName}: ${insertError.message}`);
      } else {
        created++;
      }
    }
  }

  console.log(`Created ${created} new Tier 3 items`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.slice(0, 3).forEach(e => console.log(`  - ${e}`));
  }

  // Step 5: Show new counts
  console.log('\n--- Step 5: New State ---\n');

  const { count: newTier3Count } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('tier', 3)
    .eq('status', 'pending');

  console.log(`New Tier 3 items: ${newTier3Count}`);

  // Show sample Tier 3 items
  const { data: sampleItems } = await supabase
    .from('command_center_items')
    .select('title, why_now, company_name, urgency_score, due_at')
    .eq('user_id', userId)
    .eq('tier', 3)
    .eq('status', 'pending')
    .order('urgency_score', { ascending: false })
    .limit(5);

  console.log('\n--- Sample Tier 3 Items (highest urgency) ---\n');

  sampleItems?.forEach((item, i) => {
    console.log(`${i + 1}. ${item.title}`);
    console.log(`   Company: ${item.company_name}`);
    console.log(`   Why Now: ${item.why_now}`);
    console.log(`   Urgency: ${item.urgency_score}, Due: ${item.due_at || 'No due date'}`);
    console.log();
  });

  // Show tier breakdown
  console.log('\n--- All Tiers Breakdown ---\n');

  for (let tier = 1; tier <= 5; tier++) {
    const { count } = await supabase
      .from('command_center_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tier', tier)
      .eq('status', 'pending');

    const tierNames = ['', 'RESPOND NOW', "DON'T LOSE THIS", 'KEEP YOUR WORD', 'MOVE BIG DEALS', 'BUILD PIPELINE'];
    console.log(`Tier ${tier} (${tierNames[tier]}): ${count}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
