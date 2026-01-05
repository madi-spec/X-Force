/**
 * Directly process the brentallen counter-proposal without going through cron
 *
 * This simulates what the automation would do:
 * 1. Check availability for the proposed time
 * 2. If available: create calendar event and send confirmation
 * 3. If NOT available: find alternatives and send options email
 * 4. Create as Outlook draft
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getValidToken } from '../src/lib/microsoft/auth';
// import { MicrosoftGraphClient } from '../src/lib/microsoft/graph';
import { getAlternativesAroundTime } from '../src/lib/scheduler/calendarIntegration';
import { getPromptWithVariables } from '../src/lib/ai/promptManager';
import { callAIJson } from '../src/lib/ai/core/aiClient';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const REQUEST_ID = 'f784f968-cffa-44d7-ab54-4f4e3b56c0b9';

// The prospect's counter-proposal: Monday at noon = January 5th, 2026 at 12:00 PM EST
const COUNTER_PROPOSED_TIME = new Date('2026-01-05T17:00:00.000Z'); // 12:00 PM EST in UTC

async function main() {
  console.log('Processing counter-proposal directly...\n');

  // 1. Get the scheduling request
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('*, attendees:scheduling_attendees(*)')
    .eq('id', REQUEST_ID)
    .single();

  if (reqError || !request) {
    console.error('Failed to find request:', reqError);
    process.exit(1);
  }

  console.log('Request found:');
  console.log('  Title:', request.title);
  console.log('  Timezone:', request.timezone);
  console.log('  Duration:', request.duration_minutes, 'minutes');
  console.log('  Attendees:', request.attendees?.map((a: { email: string }) => a.email).join(', '));

  // 2. Get the user's Microsoft token
  const userId = request.created_by;
  console.log('  Created by user:', userId);

  const { data: msConnection } = await supabase
    .from('microsoft_connections')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  if (!msConnection) {
    console.error('No Microsoft connection found for user');
    process.exit(1);
  }

  console.log('\nGetting Microsoft token...');
  const token = await getValidToken(userId);
  if (!token) {
    console.error('Failed to get valid Microsoft token');
    process.exit(1);
  }

  // 3. Get internal attendee emails
  const internalEmails = request.attendees
    ?.filter((a: { is_internal: boolean }) => a.is_internal)
    .map((a: { email: string }) => a.email) || [];

  // Include the user's email
  const { data: userProfile } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (userProfile?.email && !internalEmails.includes(userProfile.email)) {
    internalEmails.push(userProfile.email);
  }

  console.log('Internal attendees to check:', internalEmails);

  // 4. Get prospect info
  const externalAttendee = request.attendees?.find((a: { is_internal: boolean }) => !a.is_internal);
  const prospectEmail = externalAttendee?.email;
  const prospectName = externalAttendee?.name || prospectEmail?.split('@')[0] || 'there';

  console.log('Prospect:', prospectName, `<${prospectEmail}>`);

  // 5. Check availability using getAlternativesAroundTime
  console.log('\nChecking availability around January 5th, 2026 at 12:00 PM...');

  const slotsResult = await getAlternativesAroundTime(userId, internalEmails, {
    requestedTime: COUNTER_PROPOSED_TIME,
    durationMinutes: request.duration_minutes || 30,
    excludeTimes: [], // No previously declined times for this test
    maxAlternatives: 4,
    hourRange: 3,
    timezone: request.timezone || 'America/New_York',
  });

  console.log('\nAvailability result:');
  console.log('  Source:', slotsResult.source);
  console.log('  Calendar checked:', slotsResult.calendarChecked);
  console.log('  Slots found:', slotsResult.slots?.length || 0);

  // Check if the requested time is in the slots (meaning it's available)
  const requestedTimeAvailable = slotsResult.slots?.some(slot => {
    const slotStart = slot.start.getTime();
    const requestedStart = COUNTER_PROPOSED_TIME.getTime();
    return Math.abs(slotStart - requestedStart) < 30 * 60 * 1000; // Within 30 minutes
  }) || false;

  console.log('  Requested time available:', requestedTimeAvailable);

  if (slotsResult.slots && slotsResult.slots.length > 0) {
    console.log('  Alternative times:');
    slotsResult.slots.forEach((slot, i) => {
      console.log(`    ${i + 1}. ${slot.formatted}`);
    });
  }

  // 6. Generate email using managed prompt
  const formattedProposedTime = COUNTER_PROPOSED_TIME.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: request.timezone || 'America/New_York',
  });

  console.log('\nGenerating email using managed prompt...');

  let emailBody: string;
  let subject: string;

  try {
    const promptResult = await getPromptWithVariables('scheduler_counter_proposal_response', {
      prospectName,
      companyName: 'your company',
      meetingTitle: request.title || 'our meeting',
      proposedTime: formattedProposedTime,
      isAvailable: requestedTimeAvailable ? 'true' : 'false',
      alternativeTimes: (slotsResult.slots || []).map((slot, i) => `• ${slot.formatted}`).join('\n'),
      declinedTimes: 'None',
      senderName: 'Brent',
    });

    if (promptResult && promptResult.prompt) {
      const { data: aiResponse } = await callAIJson<{ emailBody: string }>({
        prompt: promptResult.prompt + '\n\nReturn JSON: { "emailBody": "your email text here" }',
        model: (promptResult.model as 'claude-sonnet-4-20250514') || 'claude-sonnet-4-20250514',
        maxTokens: promptResult.maxTokens || 500,
      });
      emailBody = aiResponse.emailBody || '';
    } else {
      throw new Error('Prompt not found');
    }
  } catch (promptError) {
    console.warn('Falling back to default email template:', promptError);
    if (requestedTimeAvailable) {
      emailBody = `Hi ${prospectName},

Great news! ${formattedProposedTime} works perfectly for me.

I'll send over a calendar invite shortly with all the details.

Looking forward to connecting!

Best,
Brent`;
    } else {
      const slotsList = (slotsResult.slots || []).slice(0, 3).map(s => `• ${s.formatted}`).join('\n');
      emailBody = `Hi ${prospectName},

Thanks for the suggestion! Unfortunately, ${formattedProposedTime} doesn't work on my end.

Here are some times around then that do work:
${slotsList}

Let me know which works best for you!

Best,
Brent`;
    }
  }

  if (requestedTimeAvailable) {
    subject = `Re: ${request.title || 'Meeting Confirmed'} - We're all set!`;
  } else {
    subject = `Re: ${request.title || 'Meeting Time'} - Alternative times`;
  }

  console.log('\n=== GENERATED EMAIL ===');
  console.log('Subject:', subject);
  console.log('---');
  console.log(emailBody);
  console.log('=== END EMAIL ===\n');

  // 7. Create as Outlook draft
  console.log('Creating Outlook draft...');

  // Graph client not needed - using fetch directly

  // Create the message payload
  const messagePayload = {
    subject,
    body: {
      contentType: 'Text',
      content: emailBody,
    },
    toRecipients: [
      {
        emailAddress: {
          address: prospectEmail,
          name: prospectName,
        },
      },
    ],
    singleValueExtendedProperties: [
      {
        id: 'String {00020329-0000-0000-C000-000000000046} Name X-FORCE-Category',
        value: 'Scheduler',
      },
      {
        id: 'String {00020329-0000-0000-C000-000000000046} Name X-FORCE-RequestId',
        value: REQUEST_ID,
      },
    ],
  };

  try {
    // Create a draft using the Graph API
    const response = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create draft:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('Draft created successfully!');
      console.log('  Draft ID:', result.id);
      console.log('  Subject:', result.subject);
      console.log('  To:', result.toRecipients?.[0]?.emailAddress?.address);
    }
  } catch (err) {
    console.error('Error creating draft:', err);
  }

  // 8. Update the scheduling request
  console.log('\nUpdating scheduling request status...');

  const newStatus = requestedTimeAvailable ? 'pending_confirmation' : 'negotiating';
  const newAction = requestedTimeAvailable ? 'await_prospect_confirmation' : 'await_response';

  const { error: updateError } = await supabase
    .from('scheduling_requests')
    .update({
      status: newStatus,
      next_action_type: newAction,
      updated_at: new Date().toISOString(),
    })
    .eq('id', REQUEST_ID);

  if (updateError) {
    console.error('Failed to update request:', updateError);
  } else {
    console.log('Request updated:', newStatus, '/', newAction);
  }

  // 9. Log the action
  const { error: actionError } = await supabase
    .from('scheduling_actions')
    .insert({
      scheduling_request_id: REQUEST_ID,
      action_type: requestedTimeAvailable ? 'confirmation_draft_created' : 'alternatives_draft_created',
      ai_reasoning: `Counter-proposal processed. Requested time (${formattedProposedTime}) ${requestedTimeAvailable ? 'is available' : 'is NOT available'}. ${slotsResult.slots?.length || 0} alternatives found.`,
      previous_status: 'negotiating',
      new_status: newStatus,
      actor: 'system',
    });

  if (actionError) {
    console.error('Failed to log action:', actionError);
  }

  console.log('\n=== PROCESSING COMPLETE ===');
  console.log(requestedTimeAvailable
    ? 'Confirmation draft created in Outlook. Review and send!'
    : 'Alternatives draft created in Outlook. Review and send!');
}

main().catch(console.error);
