import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { analyzeAllPending } from '../src/lib/communicationHub/analysis/analyzeCommunication';

async function main() {
  console.log('Running pending analysis...\n');
  const result = await analyzeAllPending({ limit: 50 });
  console.log('\nResults:', result);
}

main().catch(console.error);
