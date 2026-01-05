import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigate() {
  const targetEmail = 'brentallen12@gmail.com';
  const targetUserId = '11111111-1111-1111-1111-111111111009';

  console.log('===========================================');
  console.log('DIAGNOSIS: Why was counter-proposal not processed?');
  console.log('===========================================');
  console.log('');

  // Step 1: Find the inbound email (the counter-proposal)
  console.log('STEP 1: Find the counter-proposal email');
  console.log('---');

  const { data: inboundEmails, error: inErr } = await supabase
    .from('communications')
    .select('id, subject, their_participants, occurred_at, direction, content_preview, external_id, thread_id, user_id, full_content')
    .eq('direction', 'inbound')
    .eq('channel', 'email')
    .eq('user_id', targetUserId)
    .gte('occurred_at', '2026-01-01T05:00:00Z')
    .order('occurred_at', { ascending: false })
    .limit(10);

  if (inErr) {
    console.error('Error:', inErr);
    return;
  }

  const counterProposal = inboundEmails?.find(c => {
    const their = (c.their_participants as Array<{ email?: string }>) || [];
    return their.some(p => p.email?.toLowerCase() === targetEmail);
  });

  if (!counterProposal) {
    console.log('ERROR: Counter-proposal email not found!');
    return;
  }

  console.log('Found counter-proposal email:');
  console.log('  ID:', counterProposal.id);
  console.log('  External ID:', counterProposal.external_id);
  console.log('  Subject:', counterProposal.subject);
  console.log('  Occurred At:', counterProposal.occurred_at);
  console.log('  Thread ID:', counterProposal.thread_id);
  console.log('  User ID:', counterProposal.user_id);
  console.log('  Preview:', counterProposal.content_preview?.substring(0, 200));
  console.log('');

  // Step 2: Simulate findMatchingSchedulingRequest logic
  console.log('STEP 2: Simulate findMatchingSchedulingRequest()');
  console.log('---');

  // Strategy 1: Match by thread ID
  console.log('Strategy 1: Match by thread_id');
  if (counterProposal.thread_id) {
    const { data: byThread, error: threadErr } = await supabase
      .from('scheduling_requests')
      .select('id, title, status, email_thread_id')
      .eq('email_thread_id', counterProposal.thread_id)
      .not('status', 'in', '(completed,cancelled,confirmed)')
      .single();

    if (threadErr) {
      console.log('  No match by thread_id:', threadErr.message);
    } else {
      console.log('  MATCHED by thread_id!', byThread);
    }
  } else {
    console.log('  No thread_id on email - strategy 1 skipped');
  }

  // Strategy 2: Match by sender email
  console.log('');
  console.log('Strategy 2: Match by sender email (', targetEmail, ')');

  const { data: byEmail, error: emailErr } = await supabase
    .from('scheduling_attendees')
    .select(`
      id,
      email,
      side,
      scheduling_request_id,
      scheduling_request:scheduling_requests(id, title, status, email_thread_id, created_at)
    `)
    .eq('email', targetEmail.toLowerCase())
    .eq('side', 'external');

  if (emailErr) {
    console.log('  Query error:', emailErr);
  } else {
    console.log(`  Found ${byEmail?.length || 0} attendee records for this email`);

    // Filter to active scheduling requests
    const activeMatches = (byEmail || []).filter(att => {
      const req = att.scheduling_request as any;
      return req &&
        req.status !== 'completed' &&
        req.status !== 'cancelled' &&
        req.status !== 'confirmed';
    });

    console.log(`  ${activeMatches.length} are in active status (not completed/cancelled/confirmed)`);

    // Check keyword matching
    const subjectLower = (counterProposal.subject || '').toLowerCase();
    const schedulingKeywords = [
      'schedule', 'meeting', 'calendar', 'time', 'available',
      'works', 'demo', 'call', 'tuesday', 'wednesday', 'thursday',
      'friday', 'monday', 'morning', 'afternoon', 'pm', 'am',
    ];
    const hasSchedulingKeyword = schedulingKeywords.some(kw => subjectLower.includes(kw));
    console.log(`  Subject "${counterProposal.subject}" has scheduling keyword: ${hasSchedulingKeyword}`);

    for (const att of activeMatches.slice(0, 5)) {
      const req = att.scheduling_request as any;
      const wouldMatch = hasSchedulingKeyword || req.status === 'awaiting_response';
      console.log(`  - Request ${req.id}: "${req.title}" status=${req.status} wouldMatch=${wouldMatch}`);
    }
  }
  console.log('');

  // Step 3: Check if processSchedulingEmails was called
  console.log('STEP 3: Check if any scheduling actions exist for today');
  console.log('---');

  const { data: allActions, error: actErr } = await supabase
    .from('scheduling_actions')
    .select('id, scheduling_request_id, action_type, actor, created_at, message_subject, email_id')
    .gte('created_at', '2026-01-01T00:00:00Z')
    .order('created_at', { ascending: false });

  if (actErr) {
    console.log('Error querying actions:', actErr);
  } else {
    console.log(`Found ${allActions?.length || 0} scheduling actions on 2026-01-01`);
    for (const action of allActions?.slice(0, 10) || []) {
      console.log(`  ${action.created_at}: ${action.action_type} by ${action.actor}`);
      if (action.email_id) console.log(`    email_id: ${action.email_id}`);
    }
  }

  // Step 4: Check if the email was already processed
  console.log('');
  console.log('STEP 4: Check if this specific email was already processed');
  console.log('---');

  const emailId = counterProposal.external_id || counterProposal.id;
  const { data: existingAction, error: existErr } = await supabase
    .from('scheduling_actions')
    .select('id, action_type, created_at')
    .eq('email_id', emailId)
    .single();

  if (existErr) {
    console.log('No action found for email_id:', emailId);
  } else {
    console.log('Email was already processed:', existingAction);
  }

  // Step 5: Check when email sync last ran
  console.log('');
  console.log('STEP 5: Check email sync timing');
  console.log('---');

  // Compare outbound email time to scheduling request creation
  const { data: outboundEmail } = await supabase
    .from('communications')
    .select('id, subject, occurred_at, thread_id')
    .eq('direction', 'outbound')
    .eq('channel', 'email')
    .eq('thread_id', counterProposal.thread_id)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .single();

  if (outboundEmail) {
    console.log('Outbound email in same thread:');
    console.log('  Subject:', outboundEmail.subject);
    console.log('  Occurred At:', outboundEmail.occurred_at);
    console.log('  Thread ID:', outboundEmail.thread_id);
  } else {
    console.log('No outbound email found in same thread');
  }

  // Summary
  console.log('');
  console.log('===========================================');
  console.log('DIAGNOSIS SUMMARY');
  console.log('===========================================');
  console.log('');
  console.log('The counter-proposal email exists and matching logic should work.');
  console.log('');
  console.log('LIKELY ROOT CAUSES:');
  console.log('');
  console.log('1. processSchedulingEmails() was never called after email sync');
  console.log('   - The cron job only calls it if emailResult.imported > 0');
  console.log('   - Need to verify cron job ran after 05:12 UTC');
  console.log('');
  console.log('2. email_thread_id not captured on scheduling request');
  console.log('   - All scheduling requests show email_thread_id: null');
  console.log('   - Thread-based matching (Strategy 1) cannot work');
  console.log('');
  console.log('3. Multiple scheduling requests with same attendee');
  console.log('   - 17+ requests exist for brentallen12@gmail.com');
  console.log('   - Non-deterministic which one gets picked');
}

investigate().catch(console.error);
