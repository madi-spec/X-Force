import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check recent inbound emails
  const { data: emails, error: emailError } = await supabase
    .from('email_messages')
    .select('id, from_email, subject, is_sent_by_user, analysis_complete, processed_for_cc, received_at')
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(15);

  if (emailError) {
    console.log('Email query error:', emailError.message);
  }

  console.log('=== Recent Inbound Emails ===');
  console.log('Total:', emails?.length || 0);
  emails?.forEach(e => {
    const from = (e.from_email || '').substring(0, 35).padEnd(35);
    const subj = (e.subject || '').substring(0, 35);
    console.log(`${from} | analyzed:${e.analysis_complete ? 'Y' : 'N'} | cc:${e.processed_for_cc ? 'Y' : 'N'} | ${subj}`);
  });

  // Check CC items from emails
  const { data: ccItems, error: ccError } = await supabase
    .from('command_center_items')
    .select('id, source, title, created_at, tier, status')
    .or('source.eq.email_ai_analysis,source.eq.email_inbound')
    .order('created_at', { ascending: false })
    .limit(10);

  if (ccError) {
    console.log('\nCC items query error:', ccError.message);
  }

  console.log('\n=== CC Items from Emails ===');
  console.log('Count:', ccItems?.length || 0);
  ccItems?.forEach(i => {
    console.log(`${i.source} | tier:${i.tier} | status:${i.status} | ${(i.title || '').substring(0, 50)}`);
  });

  // Check for emails that are analyzed but not processed for CC
  const { data: unprocessed } = await supabase
    .from('email_messages')
    .select('id, from_email, subject, analysis_complete, processed_for_cc')
    .eq('is_sent_by_user', false)
    .eq('analysis_complete', true)
    .or('processed_for_cc.is.null,processed_for_cc.eq.false')
    .limit(5);

  console.log('\n=== Analyzed but NOT processed for CC ===');
  console.log('Count:', unprocessed?.length || 0);
  unprocessed?.forEach(e => {
    console.log(`${e.id} | ${e.from_email} | ${e.subject?.substring(0, 40)}`);
  });

  // Check one specific email to understand the full flow
  if (emails && emails.length > 0) {
    const testEmail = emails[0];
    console.log('\n=== First Email Details ===');
    console.log('ID:', testEmail.id);
    console.log('From:', testEmail.from_email);
    console.log('Subject:', testEmail.subject);
    console.log('analysis_complete:', testEmail.analysis_complete);
    console.log('processed_for_cc:', testEmail.processed_for_cc);

    // Check if there's a CC item for this email's conversation
    const { data: fullEmail } = await supabase
      .from('email_messages')
      .select('conversation_ref, user_id')
      .eq('id', testEmail.id)
      .single();

    if (fullEmail?.conversation_ref) {
      const { data: existingItem } = await supabase
        .from('command_center_items')
        .select('id, title, status, source')
        .eq('conversation_id', fullEmail.conversation_ref)
        .limit(1);

      console.log('Conversation ref:', fullEmail.conversation_ref);
      console.log('Existing CC item for conversation:', existingItem?.length ? existingItem[0] : 'NONE');
    }
  }
}

async function checkUnknownSender() {
  const { data } = await supabase
    .from('command_center_items')
    .select('id, tier, tier_trigger, title, why_now, sla_minutes, workflow_steps, context_brief')
    .eq('tier_trigger', 'unknown_sender')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('\n=== Unknown Sender Tier 1 Item ===');
  if (data) {
    console.log('Tier:', data.tier);
    console.log('Trigger:', data.tier_trigger);
    console.log('Title:', data.title);
    console.log('Why Now:', data.why_now);
    console.log('SLA Minutes:', data.sla_minutes);
    console.log('Workflow Steps:', JSON.stringify(data.workflow_steps, null, 2));
    console.log('Context Brief:', data.context_brief?.substring(0, 200));
  } else {
    console.log('No unknown sender items found');
  }
}

check().then(() => checkUnknownSender()).catch(console.error);
