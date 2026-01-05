import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMPANY_ID = '09ec1bad-007a-4dc5-a269-e4f72b60eacc';

async function main() {
  console.log('Checking FL Pest Pros extraction status...\n');

  // Check existing extraction
  const { data: existing, error: existingError } = await supabase
    .from('company_extractions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .single();

  if (existingError && existingError.code !== 'PGRST116') {
    console.log('Error checking existing:', existingError);
  } else if (existing) {
    console.log('Existing extraction found:');
    console.log('  ID:', existing.id);
    console.log('  Status:', existing.status);
    console.log('  Created:', existing.created_at);
    console.log('\nDeleting existing extraction to retry...');

    const { error: deleteError } = await supabase
      .from('company_extractions')
      .delete()
      .eq('company_id', COMPANY_ID);

    if (deleteError) {
      console.log('Delete error:', deleteError);
      return;
    }
    console.log('Deleted existing extraction.');
  } else {
    console.log('No existing extraction found.');
  }

  // Check research exists
  const { data: research, error: researchError } = await supabase
    .from('company_research')
    .select('id, version, confidence_score, status')
    .eq('company_id', COMPANY_ID)
    .single();

  if (researchError) {
    console.log('\nResearch error:', researchError);
    return;
  }

  console.log('\nResearch record:');
  console.log('  ID:', research.id);
  console.log('  Version:', research.version);
  console.log('  Confidence:', research.confidence_score);
  console.log('  Status:', research.status);

  // Now retry extract via API
  console.log('\nRetrying extract via API...');
  const res = await fetch(`http://localhost:3000/api/intelligence-v61/${COMPANY_ID}/extract`, {
    method: 'POST',
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
