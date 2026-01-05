import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMatch() {
  const subject = 'on the fly receptionist';
  const body = `Raymond Kidwell
Director of Business Development
Schedule a Meeting HERE
732-243-4537
affiliatedtech.com
Connect with us!`;

  console.log('=== TESTING COMPANY MATCH ===');
  console.log('Subject:', subject);
  console.log('Body:', body.substring(0, 100));

  // Test 1: Direct name search for "on the fly"
  console.log('\n--- Test 1: Search "on the fly" ---');
  const { data: t1 } = await supabase
    .from('companies')
    .select('id, name, domain')
    .ilike('name', '%on the fly%');
  console.log('Results:', t1?.map(c => c.name));

  // Test 2: Search for "fly"
  console.log('\n--- Test 2: Search "*fly*" ---');
  const { data: t2 } = await supabase
    .from('companies')
    .select('id, name, domain')
    .ilike('name', '%fly%');
  console.log('Results:', t2?.map(c => c.name));

  // Test 3: Extract words from subject and match
  console.log('\n--- Test 3: Word extraction from subject ---');
  const words = subject.split(' ').filter(w => w.length > 2);
  console.log('Words:', words);

  for (const word of words) {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${word}%`)
      .limit(3);

    if (data?.length) {
      console.log(`"${word}" matches:`, data.map(c => c.name));
    }
  }

  // Test 4: Try matching "on the fly" as a phrase
  console.log('\n--- Test 4: Phrase "on the fly" ---');
  const phrase = 'on the fly';
  const { data: t4 } = await supabase
    .from('companies')
    .select('id, name, domain')
    .ilike('name', `%${phrase}%`);
  console.log('Phrase match:', t4?.length ? t4[0].name : 'NONE');

  // Test 5: Get the actual company
  console.log('\n--- Test 5: Full company record ---');
  const { data: onTheFly } = await supabase
    .from('companies')
    .select('*')
    .ilike('name', '%fly%')
    .single();

  if (onTheFly) {
    console.log('Company: On the Fly Pest Solutions');
    console.log('ID:', onTheFly.id);
    console.log('Domain:', onTheFly.domain);
    console.log('Website:', onTheFly.website);
  }

  // Test 6: Does "voiceforpest" appear anywhere in the company?
  console.log('\n--- Test 6: Check for voiceforpest relationship ---');
  const { data: t6 } = await supabase
    .from('companies')
    .select('id, name, domain, website')
    .or('domain.ilike.%voiceforpest%,website.ilike.%voiceforpest%');
  console.log('voiceforpest companies:', t6?.length ? t6 : 'NONE');

  // The issue: voiceforpest.com is NOT linked to On the Fly Pest Solutions
  // We need to either:
  // 1. Update On the Fly Pest Solutions to have domain = voiceforpest.com
  // 2. Or create a domain alias system
  // 3. Or improve AI extraction to catch "on the fly" from subject
}

testMatch().catch(console.error);
