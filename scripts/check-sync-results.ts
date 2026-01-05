/**
 * Check Initial Sync Results
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const targetEmail = 'xraisales@affiliatedtech.com';

async function main() {
  console.log('='.repeat(70));
  console.log('INITIAL HISTORICAL SYNC RESULTS');
  console.log('='.repeat(70));

  // Find user
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', targetEmail)
    .single();

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`\nUser: ${user.email} (${user.id})`);

  // Check emails
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const { count: emailCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('received_at', oneMonthAgo.toISOString());

  console.log(`\n--- Data Counts ---`);
  console.log(`Emails (last month): ${emailCount}`);

  // Check transcripts
  const { count: transcriptCount } = await supabase
    .from('meeting_transcriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('meeting_date', oneMonthAgo.toISOString());

  console.log(`Transcripts (last month): ${transcriptCount}`);

  // Check calendar events
  const { count: calendarCount } = await supabase
    .from('calendar_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('start_time', oneMonthAgo.toISOString());

  console.log(`Calendar events (last month): ${calendarCount}`);

  // Check RI
  const { count: riCount } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true });

  const { count: riWithInteractions } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true })
    .not('interactions', 'is', null);

  console.log(`\n--- Relationship Intelligence ---`);
  console.log(`Total RI records: ${riCount}`);
  console.log(`RI with interactions: ${riWithInteractions}`);

  // Check command center by tier
  const { data: ccStats } = await supabase
    .from('command_center_items')
    .select('tier, status')
    .eq('user_id', user.id);

  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const pendingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const item of ccStats || []) {
    tierCounts[item.tier as keyof typeof tierCounts]++;
    if (item.status === 'pending') {
      pendingCounts[item.tier as keyof typeof pendingCounts]++;
    }
  }

  console.log(`\n--- Command Center Items ---`);
  console.log(`Total items: ${ccStats?.length || 0}`);
  console.log(`\nBy Tier (all / pending):`);
  console.log(`  Tier 1 (Respond Now): ${tierCounts[1]} / ${pendingCounts[1]}`);
  console.log(`  Tier 2 (Hot Leads): ${tierCounts[2]} / ${pendingCounts[2]}`);
  console.log(`  Tier 3 (Commitments): ${tierCounts[3]} / ${pendingCounts[3]}`);
  console.log(`  Tier 4 (Follow-ups): ${tierCounts[4]} / ${pendingCounts[4]}`);
  console.log(`  Tier 5 (Pipeline): ${tierCounts[5]} / ${pendingCounts[5]}`);

  // Example command center items
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE COMMAND CENTER ITEMS');
  console.log('='.repeat(70));

  const { data: examples } = await supabase
    .from('command_center_items')
    .select(`
      id, title, tier, tier_trigger, why_now, source, status,
      target_name, company_name, created_at
    `)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('tier', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(10);

  if (examples && examples.length > 0) {
    // Group by tier
    const tier1 = examples.filter(e => e.tier === 1).slice(0, 2);
    const tier2 = examples.filter(e => e.tier === 2).slice(0, 3);
    const tier3 = examples.filter(e => e.tier === 3).slice(0, 3);
    const tier4 = examples.filter(e => e.tier === 4).slice(0, 2);

    const showItems = [...tier1, ...tier2, ...tier3, ...tier4];

    showItems.forEach((item, index) => {
      console.log(`\n${index + 1}. [Tier ${item.tier}] ${item.tier_trigger}`);
      console.log(`   Title: ${item.title?.substring(0, 70)}${(item.title?.length || 0) > 70 ? '...' : ''}`);
      console.log(`   Why Now: ${item.why_now?.substring(0, 80) || 'N/A'}${(item.why_now?.length || 0) > 80 ? '...' : ''}`);
      console.log(`   Contact/Company: ${item.target_name || 'N/A'} / ${item.company_name || 'N/A'}`);
      console.log(`   Source: ${item.source}`);
    });
  }

  // Show RI examples
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE RELATIONSHIP INTELLIGENCE');
  console.log('='.repeat(70));

  const { data: riExamples } = await supabase
    .from('relationship_intelligence')
    .select(`
      id,
      relationship_strength,
      interactions,
      signals,
      open_commitments,
      contact:contacts(name, email),
      company:companies(name)
    `)
    .not('interactions', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(3);

  if (riExamples && riExamples.length > 0) {
    riExamples.forEach((ri, index) => {
      const contact = ri.contact as any;
      const company = ri.company as any;
      const interactions = ri.interactions as any[] || [];
      const signals = ri.signals as any || {};
      const commitments = ri.open_commitments as any || {};

      console.log(`\n${index + 1}. ${contact?.name || 'Unknown'} at ${company?.name || 'Unknown'}`);
      console.log(`   Email: ${contact?.email || 'N/A'}`);
      console.log(`   Relationship Strength: ${ri.relationship_strength || 'N/A'}`);
      console.log(`   Total Interactions: ${interactions.length}`);
      console.log(`   Buying Signals: ${signals.buying_signals?.length || 0}`);
      console.log(`   Concerns: ${signals.concerns?.length || 0}`);
      console.log(`   Our Open Commitments: ${commitments.ours?.length || 0}`);
      console.log(`   Their Open Commitments: ${commitments.theirs?.length || 0}`);

      // Show recent interaction
      if (interactions.length > 0) {
        const recent = interactions[interactions.length - 1];
        console.log(`   Last Interaction: ${recent.type} on ${recent.date?.split('T')[0] || 'unknown'}`);
      }
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
