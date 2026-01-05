/**
 * Test Context-Aware Meeting Prep
 *
 * Finds an upcoming meeting with relationship intelligence data
 * and generates the context-aware prep to verify it works.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== TEST CONTEXT-AWARE MEETING PREP ===\n');

  // Step 1: Find contacts with relationship intelligence
  console.log('--- Step 1: Finding contacts with RI data ---\n');

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, contact_id, company_id, interactions, signals, open_commitments')
    .not('interactions', 'is', null)
    .limit(5);

  if (!riRecords || riRecords.length === 0) {
    console.log('No relationship intelligence records found.');
    return;
  }

  console.log(`Found ${riRecords.length} RI records with interactions`);

  // Get the contacts with RI
  const contactIds = riRecords
    .map(r => r.contact_id)
    .filter((id): id is string => !!id);
  const companyIds = riRecords
    .map(r => r.company_id)
    .filter((id): id is string => !!id);

  // Step 2: Find meetings with these contacts
  console.log('\n--- Step 2: Finding meetings with RI contacts ---\n');

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email, title, company_id')
    .in('id', contactIds);

  if (contacts && contacts.length > 0) {
    console.log('Contacts with RI data:');
    for (const c of contacts) {
      console.log(`  - ${c.name} (${c.email})`);
    }
  }

  // Step 3: Find recent meetings that we can test with
  console.log('\n--- Step 3: Finding meetings to test ---\n');

  const { data: recentMeetings } = await supabase
    .from('activities')
    .select('id, subject, occurred_at, metadata, company_id, contact_id, deal_id')
    .eq('type', 'meeting')
    .order('occurred_at', { ascending: false })
    .limit(10);

  if (!recentMeetings || recentMeetings.length === 0) {
    console.log('No meetings found.');
    return;
  }

  console.log(`Found ${recentMeetings.length} recent meetings`);

  // Find one that has attendees with RI
  let testMeeting = null;
  let testAttendees: string[] = [];

  for (const meeting of recentMeetings) {
    const attendees = meeting.metadata?.attendees as string[] || [];
    if (attendees.length === 0) continue;

    // Check if any attendee has RI
    for (const email of attendees) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, company_id')
        .eq('email', email)
        .single();

      if (contact) {
        const { data: ri } = await supabase
          .from('relationship_intelligence')
          .select('id')
          .or(`contact_id.eq.${contact.id},company_id.eq.${contact.company_id}`)
          .limit(1)
          .single();

        if (ri) {
          testMeeting = meeting;
          testAttendees = attendees;
          break;
        }
      }
    }
    if (testMeeting) break;
  }

  if (!testMeeting) {
    console.log('No meeting found with attendees that have RI data.');
    console.log('Will test with the first meeting anyway...');
    testMeeting = recentMeetings[0];
    testAttendees = testMeeting.metadata?.attendees as string[] || [];
  }

  console.log(`\nTest Meeting: ${testMeeting.subject}`);
  console.log(`  ID: ${testMeeting.id}`);
  console.log(`  Date: ${testMeeting.occurred_at}`);
  console.log(`  Attendees: ${testAttendees.join(', ')}`);
  console.log(`  Company ID: ${testMeeting.company_id || 'none'}`);
  console.log(`  Deal ID: ${testMeeting.deal_id || 'none'}`);

  // Step 4: Test the generateMeetingPrep function
  console.log('\n--- Step 4: Testing generateContextAwareMeetingPrep ---\n');

  // Import the function
  const { generateContextAwareMeetingPrep, hasRichContext } = await import('../src/lib/intelligence/generateMeetingPrep');

  // Check for rich context
  const hasContext = await hasRichContext(testAttendees);
  console.log(`Has rich context: ${hasContext}`);

  // Prepare meeting info
  const meetingInfo = {
    id: testMeeting.id,
    title: testMeeting.subject,
    startTime: testMeeting.occurred_at,
    endTime: new Date(new Date(testMeeting.occurred_at).getTime() + 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    attendeeEmails: testAttendees,
    dealId: testMeeting.deal_id,
    companyId: testMeeting.company_id,
  };

  console.log('\nGenerating context-aware prep...\n');

  try {
    const fullPrep = await generateContextAwareMeetingPrep(meetingInfo);

    console.log('='.repeat(60));
    console.log('MEETING PREP OUTPUT');
    console.log('='.repeat(60));

    console.log(`\nMeeting: ${fullPrep.meeting.title}`);
    console.log(`Time: ${fullPrep.meeting.time}`);
    console.log(`Duration: ${fullPrep.meeting.duration} minutes`);

    console.log('\n--- ATTENDEES ---');
    for (const a of fullPrep.attendees) {
      console.log(`\n  ${a.name} (${a.email})`);
      if (a.title) console.log(`    Title: ${a.title}`);
      if (a.companyName) console.log(`    Company: ${a.companyName}`);
      console.log(`    Has Rich Context: ${!!a.context}`);
    }

    const prep = fullPrep.prep;

    console.log('\n--- QUICK CONTEXT ---');
    console.log(prep.quick_context);

    console.log('\n--- RELATIONSHIP STATUS ---');
    console.log(`  Deal: ${prep.relationship_status.deal_name || 'N/A'}`);
    console.log(`  Stage: ${prep.relationship_status.deal_stage || 'N/A'}`);
    console.log(`  Value: ${prep.relationship_status.deal_value ? `$${prep.relationship_status.deal_value.toLocaleString()}` : 'N/A'}`);
    console.log(`  Sentiment: ${prep.relationship_status.sentiment || 'N/A'}`);
    console.log(`  Days Since Contact: ${prep.relationship_status.days_since_contact ?? 'N/A'}`);
    console.log(`  Total Interactions: ${prep.relationship_status.total_interactions}`);

    console.log('\n--- OPEN ITEMS ---');
    console.log('\n  Our Commitments Due:');
    if (prep.open_items.our_commitments_due.length > 0) {
      for (const c of prep.open_items.our_commitments_due) {
        console.log(`    - ${c}`);
      }
    } else {
      console.log('    (none)');
    }

    console.log('\n  Their Commitments Pending:');
    if (prep.open_items.their_commitments_pending.length > 0) {
      for (const c of prep.open_items.their_commitments_pending) {
        console.log(`    - ${c}`);
      }
    } else {
      console.log('    (none)');
    }

    console.log('\n  Unresolved Concerns:');
    if (prep.open_items.unresolved_concerns.length > 0) {
      for (const c of prep.open_items.unresolved_concerns) {
        console.log(`    - ${c}`);
      }
    } else {
      console.log('    (none)');
    }

    console.log('\n--- TALKING POINTS ---');
    for (let i = 0; i < prep.talking_points.length; i++) {
      console.log(`  ${i + 1}. ${prep.talking_points[i]}`);
    }

    console.log('\n--- WATCH OUT FOR ---');
    if (prep.watch_out.length > 0) {
      for (const w of prep.watch_out) {
        console.log(`  - ${w}`);
      }
    } else {
      console.log('  (none)');
    }

    console.log('\n--- SUGGESTED GOALS ---');
    for (const g of prep.suggested_goals) {
      console.log(`  - ${g}`);
    }

    console.log('\n--- PERSONALIZATION ---');
    console.log('\n  Key Facts to Reference:');
    if (prep.personalization.key_facts_to_reference.length > 0) {
      for (const f of prep.personalization.key_facts_to_reference) {
        console.log(`    - ${f}`);
      }
    } else {
      console.log('    (none)');
    }
    console.log(`\n  Communication Style: ${prep.personalization.communication_style || 'Unknown'}`);

    console.log('\n--- MATERIALS ---');
    for (const m of fullPrep.materials) {
      console.log(`  [${m.type}] ${m.label} → ${m.url}`);
    }

    console.log('\n--- GENERATED AT ---');
    console.log(`  ${fullPrep.generated_at}`);

    console.log('\n' + '='.repeat(60));
    console.log('TEST PASSED: Meeting prep generated successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nERROR generating prep:', error);
  }
}

main().catch(console.error);
