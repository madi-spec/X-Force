import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const userId = '11111111-1111-1111-1111-111111111009';
const requestId = 'fd360b3e-b42a-4d52-b612-94b6e8b0e294';

async function checkCounterProposal() {
  console.log('Fetching scheduling request...');

  // Get the scheduling request
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      attendees:scheduling_attendees(*)
    `)
    .eq('id', requestId)
    .single();

  if (reqError || !request) {
    console.log('Error fetching request:', reqError);
    return;
  }

  console.log('Request:', request.title);
  console.log('Status:', request.status);
  console.log('Next action:', request.next_action_type);
  console.log('Duration:', request.duration_minutes, 'minutes');

  // Get conversation history to see the response
  console.log('\nConversation history:');
  const history = request.conversation_history || [];
  for (const msg of history) {
    console.log(`\n[${msg.direction}] ${msg.timestamp}`);
    console.log('Subject:', msg.subject);
    console.log('Body:', msg.body?.substring(0, 300) + '...');
  }

  // The prospect proposed: 11am on Monday the 5th
  // Note: January 5th, 2025 is a Sunday, so they likely mean Monday January 6th
  console.log('\n--- Checking if 11am Monday Jan 6th works ---');

  // Get Microsoft token
  const { data: conn } = await supabase
    .from('microsoft_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!conn) {
    console.log('No Microsoft connection');
    return;
  }

  // Get internal attendees
  const internalAttendees = (request.attendees || [])
    .filter((a: { side: string }) => a.side === 'internal')
    .map((a: { email: string }) => a.email);

  console.log('Internal attendees:', internalAttendees);

  // The proposed slot: Monday January 6th at 11am ET
  // In ISO format for API: 2025-01-06T11:00:00 (local time)
  const startTime = '2025-01-06T11:00:00';
  const endTime = '2025-01-06T11:30:00';

  console.log(`\nChecking availability: ${startTime} to ${endTime}`);

  // Call getSchedule to check all attendees' availability
  const scheduleResponse = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + conn.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: internalAttendees,
        startTime: {
          dateTime: startTime,
          timeZone: 'America/New_York',
        },
        endTime: {
          dateTime: endTime,
          timeZone: 'America/New_York',
        },
        availabilityViewInterval: 30,
      }),
    }
  );

  if (!scheduleResponse.ok) {
    console.log('Error:', await scheduleResponse.text());
    return;
  }

  const scheduleData = await scheduleResponse.json();

  console.log('\nAvailability results:');
  let allAvailable = true;

  for (const schedule of scheduleData.value) {
    const email = schedule.scheduleId;
    // availabilityView: 0=free, 1=tentative, 2=busy, 3=OOO, 4=working elsewhere
    const view = schedule.availabilityView || '';
    const isFree = view === '0' || view === '' || view === '4';

    console.log(`${email}: availabilityView="${view}" -> ${isFree ? 'AVAILABLE' : 'BUSY'}`);

    if (!isFree) {
      allAvailable = false;
    }

    // Also show schedule items if any
    if (schedule.scheduleItems && schedule.scheduleItems.length > 0) {
      for (const item of schedule.scheduleItems) {
        console.log(`  - ${item.subject || 'Busy'} (${item.status})`);
      }
    }
  }

  console.log('\n==============================================');
  if (allAvailable) {
    console.log('RESULT: 11:00 AM on Monday January 6th WORKS for everyone!');
    console.log('The system should accept this counter-proposal and book the meeting.');
  } else {
    console.log('RESULT: 11:00 AM on Monday January 6th does NOT work.');
    console.log('The system should suggest alternative times.');
  }
  console.log('==============================================');
}

checkCounterProposal().catch(console.error);
