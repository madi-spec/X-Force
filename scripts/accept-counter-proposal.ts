import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const userId = '11111111-1111-1111-1111-111111111009';
const requestId = 'fd360b3e-b42a-4d52-b612-94b6e8b0e294';

async function acceptCounterProposal() {
  console.log('=== Accepting Counter-Proposal ===\n');

  // Get the scheduling request
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      attendees:scheduling_attendees(*)
    `)
    .eq('id', requestId)
    .single();

  if (!request) {
    console.log('Request not found');
    return;
  }

  console.log('Request:', request.title);
  console.log('Current status:', request.status);

  // Get the external attendee (prospect)
  const externalAttendee = (request.attendees || []).find(
    (a: { side: string }) => a.side === 'external'
  );

  if (!externalAttendee) {
    console.log('No external attendee found');
    return;
  }

  console.log('Prospect:', externalAttendee.name, `<${externalAttendee.email}>`);

  // The accepted time: Monday January 6th at 11am ET
  const selectedTime = new Date('2025-01-06T11:00:00-05:00');
  const endTime = new Date('2025-01-06T11:30:00-05:00');

  console.log('\nSelected time:', selectedTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  // Step 1: Update the scheduling request with selected time
  console.log('\n--- Step 1: Update scheduling request ---');

  await supabase
    .from('scheduling_requests')
    .update({
      status: 'confirmed',
      selected_time: selectedTime.toISOString(),
      last_action_at: new Date().toISOString(),
      next_action_type: null,
      next_action_at: null,
    })
    .eq('id', requestId);

  console.log('Status updated to: confirmed');
  console.log('Selected time saved:', selectedTime.toISOString());

  // Step 2: Generate confirmation email
  console.log('\n--- Step 2: Generate confirmation email ---');

  const today = new Date();
  const formattedTime = selectedTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  });

  const emailPrompt = `Generate a brief, professional confirmation email for a scheduled meeting.

Context:
- Today's date: ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
- Sender: Brent Allen (Sales, X-RAI Labs)
- Recipient: ${externalAttendee.name} at Lawn Doctor of Warren
- Meeting: Discovery Call about AI Agents
- Confirmed time: ${formattedTime}
- Platform: Microsoft Teams (calendar invite will follow)

Write a warm but concise confirmation email. Thank them for their flexibility in finding a time that works. Mention that you'll send a calendar invite shortly with the Teams meeting link.

Keep it under 100 words. No signature block needed.`;

  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: emailPrompt,
      },
    ],
  });

  const emailBody = (aiResponse.content[0] as { type: string; text: string }).text;

  console.log('\nGenerated email:');
  console.log('---');
  console.log(emailBody);
  console.log('---');

  // Step 3: Send the confirmation email
  console.log('\n--- Step 3: Send confirmation email ---');

  const { data: conn } = await supabase
    .from('microsoft_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!conn) {
    console.log('No Microsoft connection');
    return;
  }

  const sendResponse = await fetch(
    'https://graph.microsoft.com/v1.0/me/sendMail',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + conn.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: `Re: Discovery Call - Lawn Doctor of Warren - Confirmed for ${formattedTime}`,
          body: {
            contentType: 'Text',
            content: emailBody,
          },
          toRecipients: [
            {
              emailAddress: {
                address: externalAttendee.email,
                name: externalAttendee.name,
              },
            },
          ],
        },
      }),
    }
  );

  if (!sendResponse.ok) {
    console.log('Failed to send email:', await sendResponse.text());
    return;
  }

  console.log('Confirmation email sent successfully!');

  // Step 4: Create calendar event
  console.log('\n--- Step 4: Create calendar event ---');

  // Get internal attendees for the meeting
  const internalAttendees = (request.attendees || [])
    .filter((a: { side: string }) => a.side === 'internal')
    .map((a: { email: string; name: string }) => ({
      emailAddress: { address: a.email, name: a.name },
      type: 'required',
    }));

  const allAttendees = [
    ...internalAttendees,
    {
      emailAddress: { address: externalAttendee.email, name: externalAttendee.name },
      type: 'required',
    },
  ];

  const calendarResponse = await fetch(
    'https://graph.microsoft.com/v1.0/me/events',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + conn.access_token,
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="America/New_York"',
      },
      body: JSON.stringify({
        subject: `Discovery Call - Lawn Doctor of Warren`,
        body: {
          contentType: 'Text',
          content: `Discovery call to discuss AI Agents for Lawn Doctor of Warren.\n\nAttendees: ${externalAttendee.name}, Brent Allen, Kayla Carroll`,
        },
        start: {
          dateTime: '2025-01-06T11:00:00',
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: '2025-01-06T11:30:00',
          timeZone: 'America/New_York',
        },
        attendees: allAttendees,
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      }),
    }
  );

  if (!calendarResponse.ok) {
    const errorText = await calendarResponse.text();
    console.log('Failed to create calendar event:', errorText);
    return;
  }

  const calendarEvent = await calendarResponse.json();
  console.log('Calendar event created!');
  console.log('Event ID:', calendarEvent.id);
  console.log('Teams link:', calendarEvent.onlineMeeting?.joinUrl || '(pending)');

  // Step 5: Update scheduling request with event ID
  await supabase
    .from('scheduling_requests')
    .update({
      calendar_event_id: calendarEvent.id,
      meeting_link: calendarEvent.onlineMeeting?.joinUrl,
    })
    .eq('id', requestId);

  console.log('\n=== COMPLETE ===');
  console.log('Meeting scheduled for:', formattedTime);
  console.log('All parties notified and calendar invite sent.');
}

acceptCounterProposal().catch(console.error);
