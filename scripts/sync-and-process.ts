import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { syncRecentEmails } from '../src/lib/microsoft/emailSync';
import { processSchedulingEmails } from '../src/lib/scheduler/responseProcessor';

const USER_ID = '11111111-1111-1111-1111-111111111009';

async function run() {
  console.log('Syncing recent emails...');
  const syncResult = await syncRecentEmails(USER_ID, 30);
  console.log('Synced:', syncResult.imported, 'emails');

  console.log('\nProcessing scheduling responses...');
  const schedResult = await processSchedulingEmails(USER_ID);
  console.log('Processed:', schedResult.processed, '| Matched:', schedResult.matched);
  if (schedResult.errors.length > 0) {
    console.log('Errors:', schedResult.errors);
  }
}

run().catch(console.error);
