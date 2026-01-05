import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('=== Command Center Pipeline Diagnostics ===\n');

  // 1. Check current tier distribution
  console.log('1. Current CC Items by Tier:');
  const { data: tierCounts } = await supabase
    .from('command_center_items')
    .select('tier, status')
    .eq('status', 'pending');

  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (tierCounts || []).forEach(item => {
    tiers[item.tier || 5]++;
  });
  console.log(`   Tier 1 (RESPOND NOW): ${tiers[1]}`);
  console.log(`   Tier 2 (DON'T LOSE): ${tiers[2]}`);
  console.log(`   Tier 3 (KEEP WORD): ${tiers[3]}`);
  console.log(`   Tier 4 (BIG DEALS): ${tiers[4]}`);
  console.log(`   Tier 5 (PIPELINE): ${tiers[5]}`);

  // 2. Check for transcript analysis data
  console.log('\n2. Transcript Analysis Data:');
  const { data: transcripts, error: tErr } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, analysis, cc_items_created')
    .not('analysis', 'is', null)
    .limit(5);

  if (tErr) {
    console.log(`   Error: ${tErr.message}`);
  } else {
    console.log(`   Found ${transcripts?.length || 0} transcripts with analysis`);
    const unprocessed = transcripts?.filter(t => !t.cc_items_created) || [];
    console.log(`   Unprocessed: ${unprocessed.length}`);

    if (transcripts?.length > 0) {
      const sample = transcripts[0];
      const analysis = sample.analysis;
      console.log(`   Sample: "${sample.title}"`);
      console.log(`   - ourCommitments: ${analysis?.ourCommitments?.length || 0}`);
      console.log(`   - actionItems (us): ${(analysis?.actionItems || []).filter(a => a.owner === 'us').length}`);
      console.log(`   - buyingSignals: ${analysis?.buyingSignals?.length || 0}`);
      console.log(`   - competitors: ${analysis?.extractedInfo?.competitors?.length || 0}`);
    }
  }

  // 3. Check for inbound emails
  console.log('\n3. Inbound Email Data:');
  const { data: emails, error: eErr } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, is_sent_by_user, processed_for_cc, received_at')
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(5);

  if (eErr) {
    console.log(`   Error: ${eErr.message}`);
  } else {
    console.log(`   Found ${emails?.length || 0} inbound emails (showing last 5)`);
    const unprocessed = emails?.filter(e => !e.processed_for_cc) || [];
    console.log(`   Unprocessed: ${unprocessed.length}`);

    emails?.forEach(e => {
      const keywords = ['demo', 'pricing', 'price', 'meet', 'schedule', '?'];
      const subjectLower = (e.subject || '').toLowerCase();
      const hasKeyword = keywords.some(k => subjectLower.includes(k));
      console.log(`   - "${e.subject?.substring(0, 40)}..." ${hasKeyword ? '⚡ TIER 1 KEYWORD' : ''}`);
    });
  }

  // 4. Check for deals with close dates
  console.log('\n4. Deals with Close Dates:');
  const { data: deals, error: dErr } = await supabase
    .from('deals')
    .select('id, name, expected_close_date, stage, estimated_value, days_since_activity, competitors')
    .not('stage', 'in', '("closed_won","closed_lost")')
    .not('expected_close_date', 'is', null)
    .order('expected_close_date', { ascending: true })
    .limit(5);

  if (dErr) {
    console.log(`   Error: ${dErr.message}`);
  } else {
    console.log(`   Found ${deals?.length || 0} open deals with close dates`);

    deals?.forEach(d => {
      const closeDate = new Date(d.expected_close_date);
      const now = new Date();
      const daysUntil = Math.ceil((closeDate - now) / (1000 * 60 * 60 * 24));
      const tier2 = daysUntil <= 14 || (d.competitors && d.competitors.length > 0) || d.days_since_activity >= 10;
      console.log(`   - ${d.name}: closes in ${daysUntil} days, $${d.estimated_value} ${tier2 ? '⚡ TIER 2' : ''}`);
    });
  }

  // 5. Check meeting_prep for follow-ups
  console.log('\n5. Meeting Prep (Follow-ups):');
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

  const { data: preps, error: pErr } = await supabase
    .from('meeting_prep')
    .select('id, title, end_time, follow_up_sent, has_external_attendees')
    .lt('end_time', fourHoursAgo.toISOString())
    .eq('follow_up_sent', false)
    .limit(5);

  if (pErr) {
    console.log(`   Error: ${pErr.message}`);
  } else {
    console.log(`   Found ${preps?.length || 0} meetings needing follow-up`);
    preps?.forEach(p => {
      console.log(`   - ${p.title}: external=${p.has_external_attendees} ⚡ TIER 3`);
    });
  }

  // 6. Check existing Tier 1 items for SLA
  console.log('\n6. Tier 1 SLA Status:');
  const { data: tier1Items } = await supabase
    .from('command_center_items')
    .select('id, title, tier, sla_status, sla_minutes, received_at')
    .eq('tier', 1)
    .eq('status', 'pending');

  console.log(`   Found ${tier1Items?.length || 0} Tier 1 items`);
  tier1Items?.forEach(item => {
    console.log(`   - ${item.title}: SLA=${item.sla_status || 'not set'}`);
  });

  console.log('\n=== Diagnosis Complete ===');
}

diagnose().catch(console.error);
