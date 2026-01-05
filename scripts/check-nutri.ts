import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { extractEmailsFromBody } from '../src/lib/communicationHub/matching/matchEmailToCompany';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Search for email mentioning NutriGreen in full_content
  const { data, error } = await supabase
    .from('communications')
    .select('id, subject, content_preview, full_content')
    .ilike('full_content', '%NutriGreen%')
    .limit(1);

  if (error) {
    console.log('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Subject:', data[0].subject);
    console.log('\nFull content (first 2000 chars):');
    console.log(data[0].full_content?.substring(0, 2000));

    // Extract emails from full content
    const emails = extractEmailsFromBody(data[0].full_content || '');
    console.log('\n\nExtracted emails from body:');
    console.log(emails);
  } else {
    console.log('Not found in full_content');
  }
}

check().catch(console.error);
