import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCommandCenter() {
  console.log('Testing Command Center Phase 2b features...\n');

  // 1. Test rich context fields
  console.log('1. Checking rich context fields...');
  const { data: items, error: itemsError } = await supabase
    .from('command_center_items')
    .select(`
      id,
      title,
      action_type,
      source,
      source_id,
      deal_id,
      deal_value,
      deal_probability,
      deal_stage,
      context_brief,
      win_tip,
      why_now,
      momentum_score,
      risk_score,
      status,
      deal:deals(id, name, stage, estimated_value)
    `)
    .eq('status', 'pending')
    .order('momentum_score', { ascending: false })
    .limit(3);

  if (itemsError) {
    console.log('   ❌ Error:', itemsError.message);
  } else {
    console.log('   ✅ Found', items.length, 'pending items');
    items.forEach((item, i) => {
      console.log(`\n   Item ${i + 1}: ${item.title}`);
      console.log(`      Source: ${item.source} (ID: ${item.source_id || 'none'})`);
      console.log(`      Momentum: ${item.momentum_score}, Risk: ${item.risk_score}`);
      console.log(`      Deal: ${item.deal?.name || 'none'} (${item.deal_stage || 'no stage'})`);
      console.log(`      Value: $${item.deal_value || 0} × ${item.deal_probability || 0} = $${((item.deal_value || 0) * (item.deal_probability || 0)).toFixed(0)} weighted`);
      console.log(`      Context: ${item.context_brief ? item.context_brief.substring(0, 50) + '...' : 'none'}`);
      console.log(`      Win Tip: ${item.win_tip ? item.win_tip.substring(0, 50) + '...' : 'none'}`);
    });
  }

  // 2. Test daily plan with time blocks
  console.log('\n\n2. Checking daily plans with time blocks...');
  const today = new Date().toISOString().split('T')[0];
  const { data: plans, error: planError } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('plan_date', today)
    .limit(1);

  if (planError) {
    console.log('   ❌ Error:', planError.message);
  } else if (plans.length === 0) {
    console.log('   ⚠️  No plan for today yet');
  } else {
    const plan = plans[0];
    console.log('   ✅ Found plan for today');
    console.log(`      Available: ${plan.available_minutes} min`);
    console.log(`      Meetings: ${plan.meeting_minutes} min`);
    console.log(`      Time blocks: ${plan.time_blocks?.length || 0}`);

    const meetings = (plan.time_blocks || []).filter(b => b.type === 'meeting');
    console.log(`      Meeting blocks: ${meetings.length}`);
    meetings.slice(0, 3).forEach((m, i) => {
      console.log(`         ${i + 1}. ${m.meeting_title || 'Untitled'} (${m.duration_minutes}m)`);
    });
  }

  // 3. Check for items with different statuses (for counter test)
  console.log('\n\n3. Checking item status distribution...');
  const { data: statusCounts, error: statusError } = await supabase
    .from('command_center_items')
    .select('status');

  if (statusError) {
    console.log('   ❌ Error:', statusError.message);
  } else {
    const counts = {};
    statusCounts.forEach(item => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    console.log('   ✅ Status distribution:');
    Object.entries(counts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    const completed = counts['completed'] || 0;
    const pending = counts['pending'] || 0;
    console.log(`\n   Counter display: "${completed} done · ${pending} to go"`);
  }

  console.log('\n\nPhase 2b test complete! ✨');
}

testCommandCenter().catch(console.error);
