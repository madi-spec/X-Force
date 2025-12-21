/**
 * Manual Microsoft sync
 * Run: npx tsx scripts/sync-microsoft-manual.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { syncEmails } from '../src/lib/microsoft/emailSync';
import { syncCalendarEvents } from '../src/lib/microsoft/calendarSync';

const userId = '11111111-1111-1111-1111-111111111009';

// Sync from December 1st, 2025
const sinceDate = new Date('2025-12-01T00:00:00Z');
const untilDate = new Date('2026-01-31T23:59:59Z');

async function sync() {
  console.log('Syncing Microsoft account...');
  console.log('Date range:', sinceDate.toISOString(), 'to', untilDate.toISOString());
  console.log('');

  console.log('📧 Syncing emails since Dec 1...');
  const emailResult = await syncEmails(userId, {
    sinceDate,
    maxMessages: 500, // Get more messages for historical sync
  });
  console.log('  Imported:', emailResult.imported);
  console.log('  Skipped:', emailResult.skipped);
  if (emailResult.errors.length > 0) {
    console.log('  Errors:', emailResult.errors.slice(0, 3));
  }

  console.log('\n📅 Syncing calendar since Dec 1...');
  const calResult = await syncCalendarEvents(userId, {
    sinceDate,
    untilDate,
    maxEvents: 500,
  });
  console.log('  Imported:', calResult.imported);
  console.log('  Skipped:', calResult.skipped);
  if (calResult.errors.length > 0) {
    console.log('  Errors:', calResult.errors.slice(0, 3));
  }

  console.log('\n✅ Sync complete!');
}

sync().catch(console.error);
