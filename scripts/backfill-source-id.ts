/**
 * Backfill source_id on existing command_center_items
 * Run with: npx tsx scripts/backfill-source-id.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Starting source_id backfill...\n');

  let totalFixed = 0;

  // 1. Email items - match by conversation_id
  console.log('1. Fixing email_inbound items...');
  const { data: emailItems } = await supabase
    .from('command_center_items')
    .select('id, conversation_id')
    .in('source', ['email_inbound', 'email_sync', 'email_ai_analysis'])
    .is('source_id', null)
    .not('conversation_id', 'is', null);

  for (const item of emailItems || []) {
    // Find the inbound email for this conversation
    const { data: email } = await supabase
      .from('email_messages')
      .select('id')
      .eq('conversation_ref', item.conversation_id)
      .eq('is_sent_by_user', false)
      .order('received_at', { ascending: false })
      .limit(1)
      .single();

    if (email) {
      await supabase
        .from('command_center_items')
        .update({ source_id: email.id, email_id: email.id })
        .eq('id', item.id);
      totalFixed++;
    }
  }
  console.log(`   Fixed ${emailItems?.length || 0} email items`);

  // 2. Transcript items - use meeting_id
  console.log('2. Fixing transcription items...');
  const { data: transcriptItems } = await supabase
    .from('command_center_items')
    .select('id, meeting_id')
    .eq('source', 'transcription')
    .is('source_id', null)
    .not('meeting_id', 'is', null);

  for (const item of transcriptItems || []) {
    // Find the transcript for this meeting
    const { data: transcript } = await supabase
      .from('meeting_transcriptions')
      .select('id')
      .eq('id', item.meeting_id)
      .single();

    if (transcript) {
      await supabase
        .from('command_center_items')
        .update({ source_id: transcript.id })
        .eq('id', item.id);
      totalFixed++;
    }
  }
  console.log(`   Fixed ${transcriptItems?.length || 0} transcript items`);

  // 3. System items - use deal_id as source_id
  console.log('3. Fixing system items...');
  const { data: systemItems } = await supabase
    .from('command_center_items')
    .select('id, deal_id')
    .eq('source', 'system')
    .is('source_id', null)
    .not('deal_id', 'is', null);

  for (const item of systemItems || []) {
    await supabase
      .from('command_center_items')
      .update({ source_id: item.deal_id })
      .eq('id', item.id);
    totalFixed++;
  }
  console.log(`   Fixed ${systemItems?.length || 0} system items`);

  // 4. AI recommendation items - match by conversation_id
  console.log('4. Fixing ai_recommendation items...');
  const { data: aiItems } = await supabase
    .from('command_center_items')
    .select('id, conversation_id, email_id')
    .eq('source', 'ai_recommendation')
    .is('source_id', null);

  for (const item of aiItems || []) {
    // If email_id exists, use it
    if (item.email_id) {
      await supabase
        .from('command_center_items')
        .update({ source_id: item.email_id })
        .eq('id', item.id);
      totalFixed++;
    } else if (item.conversation_id) {
      // Otherwise try to find by conversation
      const { data: email } = await supabase
        .from('email_messages')
        .select('id')
        .eq('conversation_ref', item.conversation_id)
        .eq('is_sent_by_user', false)
        .order('received_at', { ascending: false })
        .limit(1)
        .single();

      if (email) {
        await supabase
          .from('command_center_items')
          .update({ source_id: email.id, email_id: email.id })
          .eq('id', item.id);
        totalFixed++;
      }
    }
  }
  console.log(`   Processed ${aiItems?.length || 0} ai_recommendation items`);

  console.log(`\n✅ Total items fixed: ${totalFixed}`);

  // Verify
  console.log('\n📊 Verification:');
  const { data: verify } = await supabase
    .from('command_center_items')
    .select('source, source_id')
    .in('status', ['pending', 'in_progress']);

  const bySource: Record<string, { total: number; hasSourceId: number }> = {};
  verify?.forEach(item => {
    const source = item.source || 'unknown';
    if (!bySource[source]) {
      bySource[source] = { total: 0, hasSourceId: 0 };
    }
    bySource[source].total++;
    if (item.source_id) bySource[source].hasSourceId++;
  });

  console.log('\n  Source              | Total | Has source_id | Missing');
  console.log('  --------------------|-------|---------------|--------');
  Object.entries(bySource)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([source, data]) => {
      const missing = data.total - data.hasSourceId;
      const status = missing > 0 ? `⚠️  ${missing}` : '✅ 0';
      console.log(`  ${source.padEnd(20)}|  ${String(data.total).padStart(4)} |     ${String(data.hasSourceId).padStart(4)}      | ${status}`);
    });
}

main().catch(console.error);
