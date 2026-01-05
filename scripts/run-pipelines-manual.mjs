import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

// Tier 1 trigger definitions
const TIER1_TRIGGERS = [
  { trigger: 'demo_request', keywords: ['demo', 'demonstration', 'trial', 'see it in action'], slaMinutes: 15 },
  { trigger: 'pricing_request', keywords: ['pricing', 'price', 'cost', 'quote', 'proposal', 'how much'], slaMinutes: 120 },
  { trigger: 'meeting_request', keywords: ['meet', 'meeting', 'schedule', 'calendar', 'call', 'chat', 'discuss'], slaMinutes: 30 },
  { trigger: 'direct_question', keywords: ['?'], slaMinutes: 240 },
];

function detectTrigger(subject, body) {
  const text = `${subject || ''} ${body || ''}`.toLowerCase();
  for (const trigger of TIER1_TRIGGERS) {
    if (trigger.trigger === 'direct_question') {
      if (text.includes('?')) return trigger;
      continue;
    }
    for (const keyword of trigger.keywords) {
      if (text.includes(keyword.toLowerCase())) return trigger;
    }
  }
  return null;
}

async function runPipelines() {
  console.log('=== Running Pipelines Manually ===\n');

  // Get a user ID to work with
  const { data: users } = await supabase.from('users').select('id, email').limit(1);
  const userId = users?.[0]?.id;
  console.log(`Using user: ${users?.[0]?.email}\n`);

  // Pipeline 1: Process Transcripts
  console.log('--- Pipeline 1: Transcripts ---');
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('cc_items_created', false)
    .not('analysis', 'is', null)
    .limit(5);

  console.log(`Found ${transcripts?.length || 0} unprocessed transcripts`);

  for (const t of transcripts || []) {
    const analysis = t.analysis;
    let created = 0;

    // Tier 3: Our commitments
    for (const c of analysis?.ourCommitments || []) {
      const { error } = await supabase.from('command_center_items').insert({
        user_id: t.user_id,
        transcription_id: t.id,
        deal_id: t.deal_id,
        company_id: t.company_id,
        action_type: 'task_complex',
        title: `Promised: ${c.commitment.substring(0, 60)}`,
        description: c.commitment,
        why_now: `You said "${c.commitment}" ${c.when ? `by ${c.when}` : ''}`,
        tier: 3,
        tier_trigger: 'promise_made',
        commitment_text: c.commitment,
        status: 'pending',
        source: 'calendar_sync',
      });
      if (!error) created++;
      else console.log(`   Error: ${error.message}`);
    }

    // Tier 2: Buying signals
    for (const s of analysis?.buyingSignals || []) {
      if (s.strength === 'strong' || s.strength === 'moderate') {
        const { error } = await supabase.from('command_center_items').insert({
          user_id: t.user_id,
          transcription_id: t.id,
          deal_id: t.deal_id,
          company_id: t.company_id,
          action_type: 'task_complex',
          title: `Buying signal: ${s.signal.substring(0, 50)}`,
          description: s.quote || s.signal,
          why_now: `Strong buying signal: "${s.signal}"`,
          tier: 2,
          tier_trigger: 'buying_signal',
          urgency_score: s.strength === 'strong' ? 80 : 60,
          status: 'pending',
          source: 'calendar_sync',
        });
        if (!error) created++;
        else console.log(`   Error: ${error.message}`);
      }
    }

    // Mark as processed
    await supabase.from('meeting_transcriptions')
      .update({ cc_items_created: true, cc_processed_at: new Date().toISOString() })
      .eq('id', t.id);

    console.log(`   Transcript "${t.title}": created ${created} items`);
  }

  // Pipeline 2: Inbound Emails
  console.log('\n--- Pipeline 2: Inbound Emails ---');
  const { data: emails } = await supabase
    .from('email_messages')
    .select('*, conversation:conversation_ref(deal_id, company_id, contact_id)')
    .eq('processed_for_cc', false)
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(10);

  console.log(`Found ${emails?.length || 0} unprocessed emails`);

  for (const e of emails || []) {
    const trigger = detectTrigger(e.subject, e.body_text || e.body_preview);

    if (trigger) {
      const conv = e.conversation;
      const fromName = e.from_name || e.from_email?.split('@')[0];
      const received = new Date(e.received_at);
      const dueAt = new Date(received.getTime() + trigger.slaMinutes * 60 * 1000);

      const { error } = await supabase.from('command_center_items').insert({
        user_id: e.user_id,
        conversation_id: e.conversation_ref,
        deal_id: conv?.deal_id || null,
        company_id: conv?.company_id || null,
        contact_id: conv?.contact_id || null,
        action_type: trigger.trigger === 'demo_request' ? 'call' : 'email_respond',
        title: `${trigger.trigger.replace('_', ' ')}: ${fromName}`,
        description: e.subject || 'Email response needed',
        why_now: `${fromName} sent this ${Math.round((Date.now() - received) / 60000)} min ago`,
        tier: 1,
        tier_trigger: trigger.trigger,
        sla_minutes: trigger.slaMinutes,
        sla_status: 'on_track',
        received_at: e.received_at,
        due_at: dueAt.toISOString(),
        target_name: fromName,
        status: 'pending',
        source: 'email_sync',
      });

      if (!error) {
        console.log(`   ✓ Created Tier 1: ${trigger.trigger} from ${fromName}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }

    await supabase.from('email_messages')
      .update({ processed_for_cc: true, cc_processed_at: new Date().toISOString() })
      .eq('id', e.id);
  }

  // Pipeline 3: Deal Deadlines
  console.log('\n--- Pipeline 3: Deal Deadlines ---');
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const { data: deals } = await supabase
    .from('deals')
    .select('*, company:companies(name)')
    .not('stage', 'in', '("closed_won","closed_lost")')
    .lte('expected_close_date', in14Days.toISOString())
    .gte('expected_close_date', now.toISOString());

  console.log(`Found ${deals?.length || 0} deals closing within 14 days`);

  for (const d of deals || []) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('command_center_items')
      .select('id')
      .eq('deal_id', d.id)
      .eq('tier', 2)
      .eq('tier_trigger', 'deadline_critical')
      .eq('status', 'pending')
      .single();

    if (!existing) {
      const closeDate = new Date(d.expected_close_date);
      const daysUntil = Math.ceil((closeDate - now) / (1000 * 60 * 60 * 24));
      const companyName = Array.isArray(d.company) ? d.company[0]?.name : d.company?.name;

      const { error } = await supabase.from('command_center_items').insert({
        user_id: d.owner_id,
        deal_id: d.id,
        company_id: d.organization_id,
        action_type: 'call',
        title: `Close deal: ${d.name}`,
        description: `Closes in ${daysUntil} days`,
        why_now: `$${d.estimated_value?.toLocaleString()} deal closes in ${daysUntil} days`,
        tier: 2,
        tier_trigger: 'deadline_critical',
        urgency_score: daysUntil <= 3 ? 100 : daysUntil <= 7 ? 85 : 70,
        due_at: d.expected_close_date,
        deal_value: d.estimated_value,
        deal_stage: d.stage,
        company_name: companyName,
        status: 'pending',
        source: 'system',
      });

      if (!error) {
        console.log(`   ✓ Created Tier 2: ${d.name} (${daysUntil} days)`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
  }

  console.log('\n=== Pipelines Complete ===');

  // Re-check tier distribution
  const { data: tierCounts } = await supabase
    .from('command_center_items')
    .select('tier')
    .eq('status', 'pending');

  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (tierCounts || []).forEach(item => { tiers[item.tier || 5]++; });

  console.log('\nUpdated Tier Distribution:');
  console.log(`   Tier 1: ${tiers[1]}, Tier 2: ${tiers[2]}, Tier 3: ${tiers[3]}, Tier 4: ${tiers[4]}, Tier 5: ${tiers[5]}`);
}

runPipelines().catch(console.error);
