import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixCompany() {
  console.log('Fixing On the Fly Pest Solutions company domain...');

  // Update On the Fly Pest Solutions with the voiceforpest.com domain
  const { data, error } = await supabase
    .from('companies')
    .update({
      domain: 'voiceforpest.com'
    })
    .eq('id', 'cc84f618-48bf-48cc-8c5d-3d6599437b37')
    .select('id, name, domain');

  if (error) {
    console.error('Company error:', error);
  } else {
    console.log('✅ Updated company:', data);
  }

  // Also create Raymond Kidwell as a contact
  console.log('\nChecking Raymond Kidwell contact...');

  // First check if exists
  const { data: existing } = await supabase
    .from('contacts')
    .select('id, name, company_id')
    .eq('email', 'rkidwell@voiceforpest.com')
    .maybeSingle();

  if (existing) {
    console.log('Contact already exists:', existing.name);

    if (!existing.company_id) {
      // Make sure it's linked to the company
      await supabase
        .from('contacts')
        .update({ company_id: 'cc84f618-48bf-48cc-8c5d-3d6599437b37' })
        .eq('id', existing.id);
      console.log('Linked to On the Fly Pest Solutions');
    }
  } else {
    // Get user_id from the email
    const { data: email } = await supabase
      .from('email_messages')
      .select('user_id')
      .eq('from_email', 'rkidwell@voiceforpest.com')
      .limit(1)
      .single();

    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        name: 'Raymond Kidwell',
        email: 'rkidwell@voiceforpest.com',
        title: 'Director of Business Development',
        company_id: 'cc84f618-48bf-48cc-8c5d-3d6599437b37',
        phone: '732-243-4537',
        status: 'active',
        user_id: email?.user_id,
      })
      .select()
      .single();

    if (contactError) {
      console.error('Contact error:', contactError);
    } else {
      console.log('✅ Created contact:', newContact?.name);
    }
  }

  // Verify the CC item is linked
  console.log('\nVerifying Command Center item...');
  const { data: ccItem } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, company_name')
    .eq('id', '03d628e1-e6cc-4931-9df1-987100a8b845')
    .single();

  console.log('CC Item:', ccItem);
}

fixCompany().catch(console.error);
