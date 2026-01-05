/**
 * Scheduler Timezone Handling Tests
 *
 * These tests verify that timezone handling is correct throughout the scheduler.
 * The key invariants are:
 * 1. All times are stored in UTC in the database
 * 2. When displaying times to users, convert to their timezone
 * 3. When AI returns times, interpret them in the user's timezone and convert to UTC
 * 4. When sending to Calendar API, use proper timezone specifications
 */

import {
  normalizeAITimestamp,
  parseLocalTimeToUTC,
  formatUTCToLocal,
  createDateInTimezone,
  getTimezoneOffset,
  buildDateContextForAI,
  getAITimestampInstructions,
} from '../src/lib/scheduler/timezone';

describe('Scheduler Timezone Handling', () => {
  const userTimezone = 'America/New_York';

  describe('normalizeAITimestamp', () => {
    test('AI timestamp without TZ is interpreted as user timezone', () => {
      // AI returns "2026-01-06T10:30:00" (no Z, no offset)
      // User is in EST (UTC-5 in January)
      // Result should be 10:30 AM EST = 15:30 UTC
      const result = normalizeAITimestamp('2026-01-06T10:30:00', userTimezone);

      expect(result.utc).not.toBeNull();
      expect(result.wasConverted).toBe(true);
      expect(result.utc!.toISOString()).toBe('2026-01-06T15:30:00.000Z');
    });

    test('AI timestamp with Z suffix is treated as UTC', () => {
      // AI returns "2026-01-06T10:30:00Z" (explicit UTC)
      // Should stay as 10:30 UTC regardless of user timezone
      const result = normalizeAITimestamp('2026-01-06T10:30:00Z', userTimezone);

      expect(result.utc).not.toBeNull();
      expect(result.wasConverted).toBe(false);
      expect(result.utc!.toISOString()).toBe('2026-01-06T10:30:00.000Z');
    });

    test('AI timestamp with offset is parsed correctly', () => {
      // AI returns "2026-01-06T10:30:00-05:00" (EST offset)
      // Should be 10:30 EST = 15:30 UTC
      const result = normalizeAITimestamp('2026-01-06T10:30:00-05:00', userTimezone);

      expect(result.utc).not.toBeNull();
      expect(result.wasConverted).toBe(false);
      expect(result.utc!.toISOString()).toBe('2026-01-06T15:30:00.000Z');
    });

    test('handles null/undefined input', () => {
      expect(normalizeAITimestamp(null, userTimezone).utc).toBeNull();
      expect(normalizeAITimestamp(undefined, userTimezone).utc).toBeNull();
      expect(normalizeAITimestamp('', userTimezone).utc).toBeNull();
    });
  });

  describe('parseLocalTimeToUTC', () => {
    test('converts local time string to UTC', () => {
      // 10:30 AM EST should be 15:30 UTC in January (EST = UTC-5)
      const utc = parseLocalTimeToUTC('2026-01-06T10:30:00', userTimezone);
      expect(utc.toISOString()).toBe('2026-01-06T15:30:00.000Z');
    });

    test('handles time with seconds', () => {
      const utc = parseLocalTimeToUTC('2026-01-06T10:30:45', userTimezone);
      expect(utc.toISOString()).toBe('2026-01-06T15:30:45.000Z');
    });

    test('passes through UTC timestamp unchanged', () => {
      const utc = parseLocalTimeToUTC('2026-01-06T10:30:00Z', userTimezone);
      expect(utc.toISOString()).toBe('2026-01-06T10:30:00.000Z');
    });

    test('passes through timestamp with offset unchanged', () => {
      const utc = parseLocalTimeToUTC('2026-01-06T10:30:00-05:00', userTimezone);
      expect(utc.toISOString()).toBe('2026-01-06T15:30:00.000Z');
    });
  });

  describe('formatUTCToLocal', () => {
    test('converts UTC to local time string', () => {
      // 15:30 UTC should be 10:30 EST in January
      const utcDate = new Date('2026-01-06T15:30:00.000Z');
      const local = formatUTCToLocal(utcDate, userTimezone);
      expect(local).toBe('2026-01-06T10:30:00');
    });
  });

  describe('createDateInTimezone', () => {
    test('creates UTC date from local time components', () => {
      // January 6, 2026 at 10:30 AM EST = 15:30 UTC
      const utc = createDateInTimezone(2026, 1, 6, 10, 30, userTimezone);
      expect(utc.toISOString()).toBe('2026-01-06T15:30:00.000Z');
    });

    test('creates UTC date from afternoon time', () => {
      // January 6, 2026 at 2:00 PM EST = 19:00 UTC
      const utc = createDateInTimezone(2026, 1, 6, 14, 0, userTimezone);
      expect(utc.toISOString()).toBe('2026-01-06T19:00:00.000Z');
    });
  });

  describe('getTimezoneOffset', () => {
    test('returns correct offset for EST (winter)', () => {
      // January is EST (UTC-5)
      const date = new Date('2026-01-15T12:00:00Z');
      const offset = getTimezoneOffset(userTimezone, date);
      expect(offset).toBe(-5);
    });

    test('returns correct offset for EDT (summer)', () => {
      // July is EDT (UTC-4)
      const date = new Date('2026-07-15T12:00:00Z');
      const offset = getTimezoneOffset(userTimezone, date);
      expect(offset).toBe(-4);
    });
  });

  describe('DST transition handling', () => {
    test('handles EST to EDT transition (spring forward)', () => {
      // March 8, 2026 - DST starts in US (2am becomes 3am)
      // 10:30 AM on March 7 (EST) = 15:30 UTC
      const beforeDST = parseLocalTimeToUTC('2026-03-07T10:30:00', userTimezone);
      expect(beforeDST.getUTCHours()).toBe(15);

      // 10:30 AM on March 9 (EDT) = 14:30 UTC
      const afterDST = parseLocalTimeToUTC('2026-03-09T10:30:00', userTimezone);
      expect(afterDST.getUTCHours()).toBe(14);
    });

    test('handles EDT to EST transition (fall back)', () => {
      // November 1, 2026 - DST ends in US (2am becomes 1am)
      // 10:30 AM on October 31 (EDT) = 14:30 UTC
      const beforeDST = parseLocalTimeToUTC('2026-10-31T10:30:00', userTimezone);
      expect(beforeDST.getUTCHours()).toBe(14);

      // 10:30 AM on November 2 (EST) = 15:30 UTC
      const afterDST = parseLocalTimeToUTC('2026-11-02T10:30:00', userTimezone);
      expect(afterDST.getUTCHours()).toBe(15);
    });
  });

  describe('buildDateContextForAI', () => {
    test('provides correct date context', () => {
      const context = buildDateContextForAI(userTimezone);

      expect(context.currentYear).toBeGreaterThanOrEqual(2024);
      expect(context.nextYear).toBe(context.currentYear + 1);
      expect(context.todayFormatted).toContain(String(context.currentYear));
    });
  });

  describe('getAITimestampInstructions', () => {
    test('includes timezone in instructions', () => {
      const instructions = getAITimestampInstructions(userTimezone);

      expect(instructions).toContain('America/New_York');
      expect(instructions).toContain('EST'); // or EDT depending on current date
    });
  });

  describe('Round-trip conversion', () => {
    test('local -> UTC -> local preserves time', () => {
      const originalLocal = '2026-01-06T10:30:00';
      const utc = parseLocalTimeToUTC(originalLocal, userTimezone);
      const backToLocal = formatUTCToLocal(utc, userTimezone);

      expect(backToLocal).toBe(originalLocal);
    });

    test('UTC -> local -> UTC preserves time', () => {
      const originalUTC = new Date('2026-01-06T15:30:00.000Z');
      const local = formatUTCToLocal(originalUTC, userTimezone);
      const backToUTC = parseLocalTimeToUTC(local, userTimezone);

      expect(backToUTC.toISOString()).toBe(originalUTC.toISOString());
    });
  });

  describe('Edge cases', () => {
    test('handles midnight correctly', () => {
      // Midnight EST = 5:00 AM UTC
      const utc = parseLocalTimeToUTC('2026-01-06T00:00:00', userTimezone);
      expect(utc.toISOString()).toBe('2026-01-06T05:00:00.000Z');
    });

    test('handles late night correctly (date change)', () => {
      // 11:00 PM EST on Jan 6 = 4:00 AM UTC on Jan 7
      const utc = parseLocalTimeToUTC('2026-01-06T23:00:00', userTimezone);
      expect(utc.toISOString()).toBe('2026-01-07T04:00:00.000Z');
    });

    test('handles Pacific timezone', () => {
      const pacificTz = 'America/Los_Angeles';
      // 10:30 AM PST = 18:30 UTC in January (PST = UTC-8)
      const utc = parseLocalTimeToUTC('2026-01-06T10:30:00', pacificTz);
      expect(utc.toISOString()).toBe('2026-01-06T18:30:00.000Z');
    });

    test('handles Central timezone', () => {
      const centralTz = 'America/Chicago';
      // 10:30 AM CST = 16:30 UTC in January (CST = UTC-6)
      const utc = parseLocalTimeToUTC('2026-01-06T10:30:00', centralTz);
      expect(utc.toISOString()).toBe('2026-01-06T16:30:00.000Z');
    });
  });
});

describe('Calendar API Integration', () => {
  test('Calendar API should receive correct timezone format', () => {
    // When creating an event for "10:30 AM EST"
    // The API call should include timeZone: 'America/New_York'
    // and the dateTime should be the local time string

    const utcTime = new Date('2026-01-06T15:30:00.000Z');
    const userTimezone = 'America/New_York';

    // Format for Graph API (local time without Z, with separate timezone field)
    const localTimeString = formatUTCToLocal(utcTime, userTimezone);

    // This is what should be sent to the API
    const apiPayload = {
      start: {
        dateTime: localTimeString,
        timeZone: userTimezone,
      }
    };

    expect(apiPayload.start.dateTime).toBe('2026-01-06T10:30:00');
    expect(apiPayload.start.timeZone).toBe('America/New_York');
  });
});

describe('Display Formatting', () => {
  test('displays time correctly for user', () => {
    // Given a UTC time, display should show EST
    const utcDate = new Date('2026-01-06T15:30:00.000Z');
    const userTimezone = 'America/New_York';

    const display = utcDate.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: userTimezone,
      timeZoneName: 'short',
    });

    expect(display).toContain('10:30');
    expect(display).toContain('January');
    expect(display).toContain('6');
  });
});
