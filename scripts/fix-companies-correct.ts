import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixCompanies() {
  console.log('=== FIXING COMPANY DATA ===\n');

  // 1. Fix On the Fly Pest Solutions - correct domain
  console.log('1. Fixing On the Fly Pest Solutions...');
  const { data: onTheFly, error: e1 } = await supabase
    .from('companies')
    .update({
      domain: 'ontheflypestsolutions.com'
    })
    .eq('id', 'cc84f618-48bf-48cc-8c5d-3d6599437b37')
    .select('id, name, domain');

  if (e1) {
    console.error('Error:', e1);
  } else {
    console.log('✅ Updated:', onTheFly);
  }

  // 2. Check if Voice for Pest exists as a company, if not create it
  console.log('\n2. Checking Voice for Pest (sales partner)...');
  const { data: vfp } = await supabase
    .from('companies')
    .select('id, name, domain')
    .eq('domain', 'voiceforpest.com')
    .maybeSingle();

  if (vfp) {
    console.log('Voice for Pest already exists:', vfp);
  } else {
    // Get user_id from the email
    const { data: email } = await supabase
      .from('email_messages')
      .select('user_id')
      .eq('from_email', 'rkidwell@voiceforpest.com')
      .limit(1)
      .single();

    const { data: newVfp, error: e2 } = await supabase
      .from('companies')
      .insert({
        name: 'Voice for Pest',
        domain: 'voiceforpest.com',
        industry: 'sales_partner',
        user_id: email?.user_id,
      })
      .select('id, name, domain')
      .single();

    if (e2) {
      console.error('Error creating Voice for Pest:', e2);
    } else {
      console.log('✅ Created Voice for Pest:', newVfp);
    }
  }

  // 3. Get the Voice for Pest company ID for linking
  const { data: vfpCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('domain', 'voiceforpest.com')
    .single();

  // 4. Update the CC item - Raymond is from Voice for Pest, not On the Fly
  // The email is ABOUT On the Fly but FROM Voice for Pest
  console.log('\n3. Updating Command Center item...');
  const { error: e3 } = await supabase
    .from('command_center_items')
    .update({
      company_id: vfpCompany?.id || null,
      company_name: 'Voice for Pest'
    })
    .eq('id', '03d628e1-e6cc-4931-9df1-987100a8b845');

  if (e3) {
    console.error('Error updating CC item:', e3);
  } else {
    console.log('✅ CC item linked to Voice for Pest (sender\'s company)');
  }

  // 5. Verify final state
  console.log('\n=== VERIFICATION ===');

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain')
    .in('domain', ['voiceforpest.com', 'ontheflypestsolutions.com']);

  console.log('\nCompanies:');
  companies?.forEach(c => {
    console.log(`- ${c.name}: ${c.domain}`);
  });

  const { data: ccItem } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, company_name')
    .eq('id', '03d628e1-e6cc-4931-9df1-987100a8b845')
    .single();

  console.log('\nCC Item:', ccItem);
}

fixCompanies().catch(console.error);
