/**
 * Test Suite for Scheduler Timezone, Delay, and Confusion Detection Fixes
 *
 * Run with: npx tsx scripts/test-scheduler-fixes.ts
 */

import {
  parseLocalTimeToUTC,
  normalizeAITimestamp,
  formatForDisplay,
  formatForGraphAPI,
  buildDateContextForAI,
  getAITimestampInstructions,
  DEFAULT_TIMEZONE,
  getTimezoneOffset,
  normalizeTimezone,
  addMinutes,
  getDayOfWeek,
} from '../src/lib/scheduler/timezone';

// Test results tracking
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => boolean | void) {
  try {
    const result = fn();
    if (result === false) {
      failed++;
      failures.push(name);
      console.log(`❌ FAIL: ${name}`);
    } else {
      passed++;
      console.log(`✅ PASS: ${name}`);
    }
  } catch (err) {
    failed++;
    failures.push(`${name}: ${err}`);
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${err}`);
  }
}

function assertEqual(actual: any, expected: any, message?: string): boolean {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    console.log(`   Expected: ${expectedStr}`);
    console.log(`   Actual:   ${actualStr}`);
    if (message) console.log(`   ${message}`);
    return false;
  }
  return true;
}

function assertClose(actual: number, expected: number, tolerance: number, message?: string): boolean {
  if (Math.abs(actual - expected) > tolerance) {
    console.log(`   Expected: ${expected} (±${tolerance})`);
    console.log(`   Actual:   ${actual}`);
    if (message) console.log(`   ${message}`);
    return false;
  }
  return true;
}

console.log('='.repeat(70));
console.log('SCHEDULER FIXES TEST SUITE');
console.log('='.repeat(70));
console.log('');

// ============================================
// TIMEZONE UTILITY TESTS
// ============================================

console.log('\n--- TIMEZONE UTILITY TESTS ---\n');

test('normalizeTimezone: handles America/New_York', () => {
  return assertEqual(normalizeTimezone('America/New_York'), 'America/New_York');
});

test('normalizeTimezone: handles null/undefined', () => {
  return assertEqual(normalizeTimezone(null), DEFAULT_TIMEZONE) &&
         assertEqual(normalizeTimezone(undefined), DEFAULT_TIMEZONE);
});

test('normalizeTimezone: maps Eastern Standard Time to America/New_York', () => {
  return assertEqual(normalizeTimezone('Eastern Standard Time'), 'America/New_York');
});

test('normalizeTimezone: maps Pacific Standard Time to America/Los_Angeles', () => {
  return assertEqual(normalizeTimezone('Pacific Standard Time'), 'America/Los_Angeles');
});

test('getTimezoneOffset: returns correct offset for EST (approx -5)', () => {
  // Note: This depends on DST - EST is -5, EDT is -4
  const offset = getTimezoneOffset('America/New_York');
  return assertClose(offset, -5, 1, 'EST/EDT offset should be between -5 and -4');
});

test('addMinutes: adds 30 minutes correctly', () => {
  const base = new Date('2026-01-05T14:00:00Z');
  const result = addMinutes(base, 30);
  return assertEqual(result.toISOString(), '2026-01-05T14:30:00.000Z');
});

test('addMinutes: adds 90 minutes correctly (crosses hour)', () => {
  const base = new Date('2026-01-05T14:00:00Z');
  const result = addMinutes(base, 90);
  return assertEqual(result.toISOString(), '2026-01-05T15:30:00.000Z');
});

// ============================================
// CORE TIMEZONE CONVERSION TESTS
// ============================================

console.log('\n--- CORE TIMEZONE CONVERSION TESTS ---\n');

test('parseLocalTimeToUTC: 2pm EST -> 7pm UTC (the core bug fix)', () => {
  // This is THE critical test - "2pm EST" should become 19:00 UTC, not 14:00 UTC
  const localTime = '2026-01-05T14:00:00';  // 2pm local (no timezone)
  const result = parseLocalTimeToUTC(localTime, 'America/New_York');

  // In January, EST is UTC-5, so 2pm EST = 7pm UTC = 19:00 UTC
  const utcHour = result.getUTCHours();
  console.log(`   Input: ${localTime} (Eastern Time)`);
  console.log(`   Output: ${result.toISOString()}`);
  console.log(`   UTC Hour: ${utcHour} (expected: 19)`);

  return assertEqual(utcHour, 19, '2pm EST should be 19:00 UTC (7pm)');
});

test('parseLocalTimeToUTC: 9am EST -> 2pm UTC', () => {
  const localTime = '2026-01-05T09:00:00';
  const result = parseLocalTimeToUTC(localTime, 'America/New_York');
  const utcHour = result.getUTCHours();
  console.log(`   Input: ${localTime} (Eastern Time)`);
  console.log(`   Output: ${result.toISOString()}`);
  return assertEqual(utcHour, 14, '9am EST should be 14:00 UTC');
});

test('parseLocalTimeToUTC: 1:30pm EST -> 6:30pm UTC', () => {
  const localTime = '2026-01-05T13:30:00';
  const result = parseLocalTimeToUTC(localTime, 'America/New_York');
  console.log(`   Input: ${localTime} (Eastern Time)`);
  console.log(`   Output: ${result.toISOString()}`);
  return assertEqual(result.getUTCHours(), 18) && assertEqual(result.getUTCMinutes(), 30);
});

test('parseLocalTimeToUTC: already UTC (with Z) passes through', () => {
  const utcTime = '2026-01-05T19:00:00Z';
  const result = parseLocalTimeToUTC(utcTime, 'America/New_York');
  return assertEqual(result.toISOString(), '2026-01-05T19:00:00.000Z');
});

test('parseLocalTimeToUTC: with offset (-05:00) parses correctly', () => {
  const timeWithOffset = '2026-01-05T14:00:00-05:00';
  const result = parseLocalTimeToUTC(timeWithOffset, 'America/New_York');
  return assertEqual(result.getUTCHours(), 19, 'Time with -05:00 offset should be interpreted correctly');
});

// ============================================
// normalizeAITimestamp TESTS
// ============================================

console.log('\n--- AI TIMESTAMP NORMALIZATION TESTS ---\n');

test('normalizeAITimestamp: bare timestamp gets converted to UTC', () => {
  // Simulates what happens when AI returns "2026-01-05T14:00:00" (2pm local)
  const result = normalizeAITimestamp('2026-01-05T14:00:00', 'America/New_York');

  console.log(`   Input: 2026-01-05T14:00:00 (assumed Eastern Time)`);
  console.log(`   Output: ${result.utc?.toISOString()}`);
  console.log(`   Was Converted: ${result.wasConverted}`);

  return result.wasConverted === true &&
         result.utc !== null &&
         result.utc.getUTCHours() === 19;
});

test('normalizeAITimestamp: UTC timestamp (with Z) not converted', () => {
  const result = normalizeAITimestamp('2026-01-05T19:00:00Z', 'America/New_York');
  return result.wasConverted === false &&
         result.utc !== null &&
         result.utc.getUTCHours() === 19;
});

test('normalizeAITimestamp: timestamp with offset not converted', () => {
  const result = normalizeAITimestamp('2026-01-05T14:00:00-05:00', 'America/New_York');
  return result.wasConverted === false &&
         result.utc !== null &&
         result.utc.getUTCHours() === 19;
});

test('normalizeAITimestamp: null input returns null', () => {
  const result = normalizeAITimestamp(null, 'America/New_York');
  return result.utc === null && result.wasConverted === false;
});

// ============================================
// GRAPH API FORMATTING TESTS
// ============================================

console.log('\n--- GRAPH API FORMATTING TESTS ---\n');

test('formatForGraphAPI: formats UTC date to local time string', () => {
  // 7pm UTC = 2pm EST
  const utcDate = new Date('2026-01-05T19:00:00Z');
  const result = formatForGraphAPI(utcDate, 'America/New_York');

  console.log(`   Input (UTC): ${utcDate.toISOString()}`);
  console.log(`   Output (for Graph): ${result}`);

  // Should output the local time (2pm) without Z
  return result === '2026-01-05T14:00:00';
});

test('formatForGraphAPI: different timezone (PST)', () => {
  // 7pm UTC = 11am PST
  const utcDate = new Date('2026-01-05T19:00:00Z');
  const result = formatForGraphAPI(utcDate, 'America/Los_Angeles');

  console.log(`   Input (UTC): ${utcDate.toISOString()}`);
  console.log(`   Output (for Graph): ${result}`);

  return result === '2026-01-05T11:00:00';
});

// ============================================
// DISPLAY FORMATTING TESTS
// ============================================

console.log('\n--- DISPLAY FORMATTING TESTS ---\n');

test('formatForDisplay: includes timezone abbreviation', () => {
  const utcDate = new Date('2026-01-05T19:00:00Z');
  const result = formatForDisplay(utcDate, 'America/New_York');

  console.log(`   Output: ${result}`);

  // Should include EST or time zone indicator
  return result.includes('2:00') && (result.includes('EST') || result.includes('PM'));
});

// ============================================
// DATE CONTEXT FOR AI TESTS
// ============================================

console.log('\n--- AI DATE CONTEXT TESTS ---\n');

test('buildDateContextForAI: returns all required fields', () => {
  const context = buildDateContextForAI('America/New_York');

  console.log(`   Today: ${context.todayFormatted}`);
  console.log(`   Current Year: ${context.currentYear}`);
  console.log(`   Next Year: ${context.nextYear}`);
  console.log(`   Timezone Info: ${context.timezoneInfo.substring(0, 50)}...`);

  return context.todayFormatted !== undefined &&
         context.currentYear !== undefined &&
         context.nextYear === context.currentYear + 1 &&
         context.timezoneInfo.includes('America/New_York');
});

test('getAITimestampInstructions: includes timezone info', () => {
  const instructions = getAITimestampInstructions('America/New_York');

  console.log(`   Instructions preview: ${instructions.substring(0, 100)}...`);

  return instructions.includes('America/New_York') &&
         instructions.includes('EST') || instructions.includes('Eastern');
});

// ============================================
// REAL-WORLD SCENARIO TESTS
// ============================================

console.log('\n--- REAL-WORLD SCENARIO TESTS ---\n');

test('Scenario: Brad says "2pm EST" - should become 19:00 UTC', () => {
  // This is exactly what happened with Brad
  // He said "Monday Jan 5 at 2pm est"
  // AI might return "2026-01-05T14:00:00" (bare timestamp)
  // We need to convert this to UTC properly

  const aiResponse = '2026-01-05T14:00:00';  // What AI might return
  const normalized = normalizeAITimestamp(aiResponse, 'America/New_York');

  console.log(`   AI returned: ${aiResponse}`);
  console.log(`   Normalized to UTC: ${normalized.utc?.toISOString()}`);

  if (!normalized.utc) return false;

  // 2pm EST = 19:00 UTC
  const correctUTC = new Date('2026-01-05T19:00:00Z');
  const diff = Math.abs(normalized.utc.getTime() - correctUTC.getTime());

  return diff < 1000; // Within 1 second
});

test('Scenario: Brad says "1:30pm" - should become 18:30 UTC', () => {
  const aiResponse = '2026-01-05T13:30:00';
  const normalized = normalizeAITimestamp(aiResponse, 'America/New_York');

  console.log(`   AI returned: ${aiResponse}`);
  console.log(`   Normalized to UTC: ${normalized.utc?.toISOString()}`);

  if (!normalized.utc) return false;

  // 1:30pm EST = 18:30 UTC
  return normalized.utc.getUTCHours() === 18 && normalized.utc.getUTCMinutes() === 30;
});

test('Scenario: Graph API call should use local time format', () => {
  // When we check availability or create events, we send local time to Graph API
  // with a timeZone parameter

  const meetingTimeUTC = new Date('2026-01-05T19:00:00Z'); // 2pm EST in UTC
  const graphFormat = formatForGraphAPI(meetingTimeUTC, 'America/New_York');

  console.log(`   Meeting time (UTC): ${meetingTimeUTC.toISOString()}`);
  console.log(`   For Graph API: ${graphFormat}`);

  // Should be local time without Z
  return graphFormat === '2026-01-05T14:00:00' && !graphFormat.includes('Z');
});

// ============================================
// EDGE CASE TESTS
// ============================================

console.log('\n--- EDGE CASE TESTS ---\n');

test('Edge case: Midnight EST', () => {
  const localTime = '2026-01-05T00:00:00';
  const result = parseLocalTimeToUTC(localTime, 'America/New_York');

  console.log(`   Input: ${localTime} (midnight EST)`);
  console.log(`   Output: ${result.toISOString()}`);

  // Midnight EST = 5am UTC
  return result.getUTCHours() === 5;
});

test('Edge case: 11pm EST (crosses day boundary)', () => {
  const localTime = '2026-01-05T23:00:00';
  const result = parseLocalTimeToUTC(localTime, 'America/New_York');

  console.log(`   Input: ${localTime} (11pm EST Jan 5)`);
  console.log(`   Output: ${result.toISOString()}`);

  // 11pm EST = 4am UTC next day
  return result.getUTCHours() === 4 && result.getUTCDate() === 6;
});

test('Edge case: Pacific timezone', () => {
  const localTime = '2026-01-05T14:00:00';  // 2pm PST
  const result = parseLocalTimeToUTC(localTime, 'America/Los_Angeles');

  console.log(`   Input: ${localTime} (2pm PST)`);
  console.log(`   Output: ${result.toISOString()}`);

  // 2pm PST = 10pm UTC (PST is UTC-8)
  return result.getUTCHours() === 22;
});

// ============================================
// RESULTS SUMMARY
// ============================================

console.log('\n' + '='.repeat(70));
console.log('TEST RESULTS');
console.log('='.repeat(70));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  - ${f}`));
}

console.log('\n' + '='.repeat(70));

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED! Timezone fixes are working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the failures above.');
  process.exit(1);
}
