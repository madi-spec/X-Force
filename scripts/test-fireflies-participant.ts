/**
 * Test Fireflies Sync - Verify Participant Meetings Are Included
 *
 * This script tests that meetings where you were a participant (not organizer)
 * are now being fetched by the Fireflies sync.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import { FirefliesClient } from '../src/lib/fireflies/client';

async function testFirefliesParticipantMeetings() {
  const supabase = createAdminClient();

  console.log('='.repeat(60));
  console.log('FIREFLIES PARTICIPANT MEETINGS TEST');
  console.log('='.repeat(60));

  // Get the active Fireflies connection
  const { data: connections, error: connError } = await supabase
    .from('fireflies_connections')
    .select('*')
    .eq('is_active', true);

  if (connError || !connections || connections.length === 0) {
    console.error('No active Fireflies connection found');
    process.exit(1);
  }

  const connection = connections[0];
  console.log('\nFireflies connection found for user:', connection.user_id);

  const client = new FirefliesClient(connection.api_key);

  // Test the connection first
  console.log('\n--- Testing Connection ---');
  const user = await client.getUser();
  console.log('Connected as:', user.email, '(' + user.name + ')');

  // Fetch transcripts with mine=false (include participant meetings)
  console.log('\n--- Fetching All Accessible Transcripts (mine=false) ---');
  const allTranscripts = await client.getTranscripts({
    limit: 50,
    includeParticipantMeetings: true,
  });

  console.log('Total transcripts found:', allTranscripts.length);

  // Fetch transcripts with mine=true (only owner meetings)
  console.log('\n--- Fetching Owner-Only Transcripts (mine=true) ---');
  const ownerOnlyTranscripts = await client.getTranscripts({
    limit: 50,
    includeParticipantMeetings: false,
  });

  console.log('Owner-only transcripts:', ownerOnlyTranscripts.length);

  // Calculate difference
  const participantMeetings = allTranscripts.length - ownerOnlyTranscripts.length;
  console.log('\n--- RESULT ---');
  console.log('Participant-only meetings (not organizer):', participantMeetings);

  // Look for "Lookout" in meeting titles
  console.log('\n--- Searching for "Lookout Pest" Meeting ---');
  const lookoutMeetings = allTranscripts.filter(t =>
    t.title.toLowerCase().includes('lookout')
  );

  if (lookoutMeetings.length > 0) {
    console.log('✅ Found Lookout Pest meeting(s):');
    for (const m of lookoutMeetings) {
      const date = new Date(m.date);
      console.log(`  - "${m.title}"`);
      console.log(`    Date: ${date.toLocaleString()}`);
      console.log(`    Organizer: ${m.organizer_email}`);
      console.log(`    Participants: ${m.participants.join(', ')}`);
    }
  } else {
    console.log('❌ No Lookout Pest meeting found in results');
    console.log('\nRecent meetings (last 10):');
    const sorted = [...allTranscripts].sort((a, b) => b.date - a.date).slice(0, 10);
    for (const m of sorted) {
      const date = new Date(m.date);
      console.log(`  - "${m.title}" (${date.toLocaleDateString()})`);
      console.log(`    Organizer: ${m.organizer_email}`);
    }
  }

  // Show today's meetings
  console.log('\n--- Today\'s Meetings ---');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMeetings = allTranscripts.filter(t => {
    const meetingDate = new Date(t.date);
    return meetingDate >= today;
  });

  if (todayMeetings.length > 0) {
    for (const m of todayMeetings) {
      const date = new Date(m.date);
      console.log(`  - "${m.title}" at ${date.toLocaleTimeString()}`);
      console.log(`    Organizer: ${m.organizer_email}`);
      console.log(`    Participants: ${m.participants.slice(0, 3).join(', ')}${m.participants.length > 3 ? '...' : ''}`);
    }
  } else {
    console.log('  No meetings recorded today yet');
  }

  console.log('\n' + '='.repeat(60));
}

testFirefliesParticipantMeetings().catch(console.error);
