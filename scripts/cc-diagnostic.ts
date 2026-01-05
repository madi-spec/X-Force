import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runDiagnostic() {
  console.log('='.repeat(60));
  console.log('COMMAND CENTER DIAGNOSTIC');
  console.log('='.repeat(60));

  // 1. Tier + Trigger + Source breakdown
  console.log('\n--- 1. TIER/TRIGGER/SOURCE DISTRIBUTION ---');
  const { data: tierData } = await supabase.rpc('execute_sql', {
    query: `
      SELECT tier, tier_trigger, source, COUNT(*) as count
      FROM command_center_items
      WHERE status = 'pending'
      GROUP BY tier, tier_trigger, source
      ORDER BY tier, count DESC
    `
  });

  // Fallback if RPC doesn't exist
  const { data: items1 } = await supabase
    .from('command_center_items')
    .select('tier, tier_trigger, source')
    .eq('status', 'pending');

  if (items1) {
    const grouped: Record<string, number> = {};
    items1.forEach(item => {
      const key = `Tier ${item.tier} | ${item.tier_trigger || 'null'} | ${item.source}`;
      grouped[key] = (grouped[key] || 0) + 1;
    });
    Object.entries(grouped)
      .sort((a, b) => {
        const tierA = parseInt(a[0].split(' ')[1]);
        const tierB = parseInt(b[0].split(' ')[1]);
        return tierA - tierB || b[1] - a[1];
      })
      .forEach(([key, count]) => {
        console.log(`${key}: ${count}`);
      });
  }

  // 2. Source ID presence by tier
  console.log('\n--- 2. SOURCE_ID PRESENCE BY TIER ---');
  const { data: items2 } = await supabase
    .from('command_center_items')
    .select('tier, source_id, source')
    .eq('status', 'pending');

  if (items2) {
    const sourcePresence: Record<string, { has: number; missing: number }> = {};
    items2.forEach(item => {
      const key = `Tier ${item.tier}`;
      if (!sourcePresence[key]) sourcePresence[key] = { has: 0, missing: 0 };
      if (item.source_id) {
        sourcePresence[key].has++;
      } else {
        sourcePresence[key].missing++;
      }
    });
    Object.entries(sourcePresence).forEach(([tier, counts]) => {
      console.log(`${tier}: has_source=${counts.has}, no_source=${counts.missing}`);
    });
  }

  // 3. Email AI analysis output
  console.log('\n--- 3. EMAIL AI CLASSIFICATION OUTPUT ---');
  const { data: emails } = await supabase
    .from('email_messages')
    .select('subject, from_email, analysis_result')
    .eq('analysis_complete', true)
    .order('received_at', { ascending: false })
    .limit(10);

  if (emails) {
    emails.forEach(email => {
      const analysis = email.analysis_result as any;
      const ccClass = analysis?.command_center_classification;
      const commType = analysis?.email_analysis?.communication_type;
      console.log(`\n${email.from_email?.substring(0, 30)}`);
      console.log(`  Subject: ${email.subject?.substring(0, 40)}`);
      console.log(`  communication_type: ${commType || 'NOT SET'}`);
      if (ccClass) {
        console.log(`  cc_class.tier: ${ccClass.tier}`);
        console.log(`  cc_class.tier_trigger: ${ccClass.tier_trigger}`);
      } else {
        console.log(`  command_center_classification: NOT SET`);
      }
    });
  }

  // 4. Tier distribution summary
  console.log('\n--- 4. TIER DISTRIBUTION SUMMARY ---');
  const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  items1?.forEach(item => {
    tierCounts[item.tier] = (tierCounts[item.tier] || 0) + 1;
  });
  const total = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  Object.entries(tierCounts).forEach(([tier, count]) => {
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
    const bar = '█'.repeat(Math.round(count / Math.max(1, total / 20)));
    console.log(`Tier ${tier}: ${count} (${pct}%) ${bar}`);
  });

  // 5. Check for "On The Fly" company
  console.log('\n--- 5. COMPANY MATCHING CHECK ---');
  const { data: otfCompany } = await supabase
    .from('companies')
    .select('id, name, domain')
    .or('name.ilike.%on the fly%,name.ilike.%onthefly%,domain.ilike.%onthefly%');

  console.log('Companies matching "On The Fly":', otfCompany?.length || 0);
  otfCompany?.forEach(c => console.log(`  - ${c.name} (${c.domain})`));

  // 6. Check voiceforpest email
  console.log('\n--- 6. VOICEFORPEST EMAIL ANALYSIS ---');
  const { data: vfpEmail } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, body_text, analysis_result')
    .ilike('from_email', '%voiceforpest%')
    .limit(1)
    .single();

  if (vfpEmail) {
    console.log('Email ID:', vfpEmail.id);
    console.log('Subject:', vfpEmail.subject);
    console.log('Body preview:', vfpEmail.body_text?.substring(0, 200));
    const analysis = vfpEmail.analysis_result as any;
    console.log('AI extracted company:', analysis?.email_analysis?.detected_company || 'NONE');
  }

  // 7. Unique tier_triggers being used
  console.log('\n--- 7. UNIQUE TIER_TRIGGERS IN USE ---');
  const triggers: Record<string, number> = {};
  items1?.forEach(item => {
    const t = item.tier_trigger || 'null';
    triggers[t] = (triggers[t] || 0) + 1;
  });
  Object.entries(triggers)
    .sort((a, b) => b[1] - a[1])
    .forEach(([trigger, count]) => {
      console.log(`  ${trigger}: ${count}`);
    });

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
}

runDiagnostic().catch(console.error);
