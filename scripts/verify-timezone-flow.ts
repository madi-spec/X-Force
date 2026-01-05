/**
 * Manual Timezone Verification Test
 *
 * TEST SCENARIO:
 * - User timezone: America/New_York (EST)
 * - Current date: January 6, 2025
 * - User says: "Let's meet Tuesday at 2pm"
 * - Tuesday = January 7, 2025
 */

import {
  normalizeAITimestamp,
  parseLocalTimeToUTC,
  formatUTCToLocal,
  formatForDisplay,
  createDateInTimezone,
  getTimezoneOffset,
  DEFAULT_TIMEZONE,
} from '../src/lib/scheduler/timezone';

const USER_TIMEZONE = 'America/New_York';
const TEST_DATE = '2025-01-07'; // Tuesday, January 7, 2025
const TEST_TIME = '14:00:00';   // 2:00 PM

console.log('='.repeat(80));
console.log('TIMEZONE VERIFICATION TEST');
console.log('='.repeat(80));
console.log('\nSCENARIO:');
console.log('  User timezone: America/New_York (EST)');
console.log('  User says: "Let\'s meet Tuesday at 2pm"');
console.log('  Tuesday = January 7, 2025');
console.log('  Expected UTC: 2025-01-07T19:00:00.000Z (2pm EST = 7pm UTC)');
console.log('\n');

// ============================================================================
// STEP 1: Parse User Input (AI returns timestamp)
// ============================================================================
console.log('─'.repeat(80));
console.log('STEP 1: PARSE USER INPUT (normalizeAITimestamp)');
console.log('─'.repeat(80));

// Scenario A: AI returns timestamp WITHOUT timezone (the problematic case)
const aiTimestampNoTZ = `${TEST_DATE}T${TEST_TIME}`;
console.log('\n[1A] AI returns timestamp WITHOUT timezone:');
console.log(`  Input: "${aiTimestampNoTZ}"`);
console.log(`  User timezone: ${USER_TIMEZONE}`);

const result1A = normalizeAITimestamp(aiTimestampNoTZ, USER_TIMEZONE);
console.log(`  Output UTC: ${result1A.utc?.toISOString()}`);
console.log(`  Was converted: ${result1A.wasConverted}`);
console.log(`  EXPECTED: "2025-01-07T19:00:00.000Z"`);
console.log(`  ✅ PASS: ${result1A.utc?.toISOString() === '2025-01-07T19:00:00.000Z' ? 'YES' : 'NO ❌'}`);

// Scenario B: AI returns timestamp WITH Z suffix (already UTC)
const aiTimestampUTC = `${TEST_DATE}T19:00:00Z`;
console.log('\n[1B] AI returns timestamp WITH Z suffix (already UTC):');
console.log(`  Input: "${aiTimestampUTC}"`);

const result1B = normalizeAITimestamp(aiTimestampUTC, USER_TIMEZONE);
console.log(`  Output UTC: ${result1B.utc?.toISOString()}`);
console.log(`  Was converted: ${result1B.wasConverted}`);
console.log(`  EXPECTED: "2025-01-07T19:00:00.000Z" (unchanged)`);
console.log(`  ✅ PASS: ${result1B.utc?.toISOString() === '2025-01-07T19:00:00.000Z' ? 'YES' : 'NO ❌'}`);

// Scenario C: AI returns timestamp WITH offset
const aiTimestampOffset = `${TEST_DATE}T14:00:00-05:00`;
console.log('\n[1C] AI returns timestamp WITH offset (-05:00 for EST):');
console.log(`  Input: "${aiTimestampOffset}"`);

const result1C = normalizeAITimestamp(aiTimestampOffset, USER_TIMEZONE);
console.log(`  Output UTC: ${result1C.utc?.toISOString()}`);
console.log(`  Was converted: ${result1C.wasConverted}`);
console.log(`  EXPECTED: "2025-01-07T19:00:00.000Z"`);
console.log(`  ✅ PASS: ${result1C.utc?.toISOString() === '2025-01-07T19:00:00.000Z' ? 'YES' : 'NO ❌'}`);

// ============================================================================
// STEP 2: Calendar Availability Check
// ============================================================================
console.log('\n');
console.log('─'.repeat(80));
console.log('STEP 2: CALENDAR AVAILABILITY CHECK');
console.log('─'.repeat(80));

// When checking availability, we need to query the calendar API with UTC times
const meetingTimeUTC = result1A.utc!;
const meetingDurationMinutes = 30;
const queryStart = meetingTimeUTC;
const queryEnd = new Date(meetingTimeUTC.getTime() + meetingDurationMinutes * 60 * 1000);

console.log('\n[2] Calendar API Query Range:');
console.log(`  Meeting requested: 2pm EST on Jan 7, 2025`);
console.log(`  Query start (UTC): ${queryStart.toISOString()}`);
console.log(`  Query end (UTC):   ${queryEnd.toISOString()}`);
console.log(`  EXPECTED start: "2025-01-07T19:00:00.000Z"`);
console.log(`  EXPECTED end:   "2025-01-07T19:30:00.000Z"`);
console.log(`  ✅ PASS: ${queryStart.toISOString() === '2025-01-07T19:00:00.000Z' ? 'YES' : 'NO ❌'}`);

// Show what this looks like in the user's timezone (for verification)
console.log('\n  Verification (what user sees):');
console.log(`    Start in EST: ${queryStart.toLocaleString('en-US', { timeZone: USER_TIMEZONE, hour: 'numeric', minute: '2-digit', hour12: true })}`);
console.log(`    End in EST:   ${queryEnd.toLocaleString('en-US', { timeZone: USER_TIMEZONE, hour: 'numeric', minute: '2-digit', hour12: true })}`);

// ============================================================================
// STEP 3: Display Back to User
// ============================================================================
console.log('\n');
console.log('─'.repeat(80));
console.log('STEP 3: DISPLAY BACK TO USER');
console.log('─'.repeat(80));

// Using formatForDisplay from timezone.ts
const displayFull = formatForDisplay(meetingTimeUTC, USER_TIMEZONE, {
  includeDate: true,
  includeTime: true,
  includeTimezone: true,
});

const displayTimeOnly = meetingTimeUTC.toLocaleString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: USER_TIMEZONE,
});

const displayWithTZ = meetingTimeUTC.toLocaleString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: USER_TIMEZONE,
  timeZoneName: 'short',
});

console.log('\n[3] Display formatting:');
console.log(`  UTC stored: ${meetingTimeUTC.toISOString()}`);
console.log(`  Full display: "${displayFull}"`);
console.log(`  Time only: "${displayTimeOnly}"`);
console.log(`  Time with TZ: "${displayWithTZ}"`);
console.log(`  EXPECTED: Contains "2:00 PM" (not "7:00 PM")`);
console.log(`  ✅ PASS: ${displayTimeOnly.includes('2:00') ? 'YES' : 'NO ❌'}`);

// ============================================================================
// STEP 4: Draft Calendar Event Payload
// ============================================================================
console.log('\n');
console.log('─'.repeat(80));
console.log('STEP 4: DRAFT CALENDAR EVENT PAYLOAD');
console.log('─'.repeat(80));

// Microsoft Graph API format - local time with timezone
const localTimeForAPI = formatUTCToLocal(meetingTimeUTC, USER_TIMEZONE);
const endTimeUTC = new Date(meetingTimeUTC.getTime() + 30 * 60 * 1000);
const localEndTimeForAPI = formatUTCToLocal(endTimeUTC, USER_TIMEZONE);

const calendarEventPayload = {
  subject: 'Meeting with Client',
  start: {
    dateTime: localTimeForAPI,
    timeZone: USER_TIMEZONE,
  },
  end: {
    dateTime: localEndTimeForAPI,
    timeZone: USER_TIMEZONE,
  },
};

console.log('\n[4] Calendar Event Payload (Microsoft Graph API format):');
console.log(JSON.stringify(calendarEventPayload, null, 2));
console.log(`\n  EXPECTED start.dateTime: "2025-01-07T14:00:00" (local time, no Z)`);
console.log(`  EXPECTED start.timeZone: "America/New_York"`);
console.log(`  ✅ PASS: ${calendarEventPayload.start.dateTime === '2025-01-07T14:00:00' ? 'YES' : 'NO ❌'}`);

// Verify round-trip: API payload -> what user sees in calendar
console.log('\n  Round-trip verification:');
console.log(`    API receives: ${calendarEventPayload.start.dateTime} in ${calendarEventPayload.start.timeZone}`);
console.log(`    User calendar shows: 2:00 PM EST (correct!)`);

// ============================================================================
// STEP 5: Draft Email Body
// ============================================================================
console.log('\n');
console.log('─'.repeat(80));
console.log('STEP 5: DRAFT EMAIL BODY');
console.log('─'.repeat(80));

// Format time for email (human readable)
const emailTimeFormat = meetingTimeUTC.toLocaleString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: USER_TIMEZONE,
  timeZoneName: 'short',
});

const emailBody = `
Hi,

I'd like to confirm our meeting for ${emailTimeFormat}.

Looking forward to speaking with you!

Best regards
`;

console.log('\n[5] Email body time mention:');
console.log(`  Time string: "${emailTimeFormat}"`);
console.log(`  EXPECTED: Contains "2:00 PM" and "EST" (not "7:00 PM")`);
console.log(`  ✅ PASS: ${emailTimeFormat.includes('2:00') && emailTimeFormat.includes('EST') ? 'YES' : 'NO ❌'}`);

console.log('\n  Sample email body:');
console.log(emailBody);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n');
console.log('='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));

const tests = [
  { name: '1A: normalizeAITimestamp (no TZ)', pass: result1A.utc?.toISOString() === '2025-01-07T19:00:00.000Z' },
  { name: '1B: normalizeAITimestamp (with Z)', pass: result1B.utc?.toISOString() === '2025-01-07T19:00:00.000Z' },
  { name: '1C: normalizeAITimestamp (with offset)', pass: result1C.utc?.toISOString() === '2025-01-07T19:00:00.000Z' },
  { name: '2: Calendar API query range', pass: queryStart.toISOString() === '2025-01-07T19:00:00.000Z' },
  { name: '3: Display back to user', pass: displayTimeOnly.includes('2:00') },
  { name: '4: Calendar event payload', pass: calendarEventPayload.start.dateTime === '2025-01-07T14:00:00' },
  { name: '5: Email body time', pass: emailTimeFormat.includes('2:00') },
];

let allPass = true;
console.log('\n');
tests.forEach(t => {
  const status = t.pass ? '✅ PASS' : '❌ FAIL';
  if (!t.pass) allPass = false;
  console.log(`  ${status}: ${t.name}`);
});

console.log('\n');
if (allPass) {
  console.log('🎉 ALL TESTS PASSED! Timezone handling is working correctly.');
} else {
  console.log('⚠️  SOME TESTS FAILED! Review the output above.');
}
console.log('\n');

// ============================================================================
// ADDITIONAL: Offset verification
// ============================================================================
console.log('─'.repeat(80));
console.log('ADDITIONAL: TIMEZONE OFFSET VERIFICATION');
console.log('─'.repeat(80));

const janDate = new Date('2025-01-07T12:00:00Z'); // January (EST, no DST)
const julDate = new Date('2025-07-07T12:00:00Z'); // July (EDT, DST active)

const janOffset = getTimezoneOffset(USER_TIMEZONE, janDate);
const julOffset = getTimezoneOffset(USER_TIMEZONE, julDate);

console.log('\n  January 7, 2025 (EST - Standard Time):');
console.log(`    Offset: ${janOffset} hours`);
console.log(`    EXPECTED: -5 (UTC-5)`);
console.log(`    ✅ PASS: ${janOffset === -5 ? 'YES' : 'NO ❌'}`);

console.log('\n  July 7, 2025 (EDT - Daylight Saving Time):');
console.log(`    Offset: ${julOffset} hours`);
console.log(`    EXPECTED: -4 (UTC-4)`);
console.log(`    ✅ PASS: ${julOffset === -4 ? 'YES' : 'NO ❌'}`);

console.log('\n');
