import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { MicrosoftGraphClient } from '../src/lib/microsoft/graph';
import { getValidToken } from '../src/lib/microsoft/auth';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testTagging() {
  console.log('=== Testing Email Tagging Logic ===\n');

  // Get an email_inbound command center item
  const { data: item, error } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, conversation_id, company_id, contact_id')
    .eq('source', 'email_inbound')
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (error || !item) {
    console.log('No email_inbound item found:', error?.message);
    return;
  }

  console.log('Test item:');
  console.log('  ID:', item.id);
  console.log('  Title:', item.title?.substring(0, 50));
  console.log('  source_id:', item.source_id);
  console.log('  conversation_id:', item.conversation_id);
  console.log('  company_id:', item.company_id);
  console.log('  contact_id:', item.contact_id);

  // Try to find external_id using the same logic as the API
  let externalId: string | null = null;

  // Step 1: Try source_id
  if (item.source_id) {
    const { data: comm } = await supabase
      .from('communications')
      .select('external_id')
      .eq('id', item.source_id)
      .single();

    if (comm?.external_id) {
      externalId = comm.external_id;
      console.log('\n✓ Found external_id via source_id');
    }
  }

  // Step 2: Try conversation_id
  if (!externalId && item.conversation_id) {
    const { data: comm } = await supabase
      .from('communications')
      .select('external_id')
      .eq('id', item.conversation_id)
      .single();

    if (comm?.external_id) {
      externalId = comm.external_id;
      console.log('\n✓ Found external_id via conversation_id');
    }
  }

  // Step 3: Fallback to contact_id or company_id
  if (!externalId && (item.contact_id || item.company_id)) {
    let query = supabase
      .from('communications')
      .select('external_id, subject')
      .eq('direction', 'inbound')
      .not('external_id', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(1);

    if (item.contact_id) {
      query = query.eq('contact_id', item.contact_id);
      console.log('\nLooking up by contact_id...');
    } else if (item.company_id) {
      query = query.eq('company_id', item.company_id);
      console.log('\nLooking up by company_id...');
    }

    const { data: comm } = await query.single();
    if (comm?.external_id) {
      externalId = comm.external_id;
      console.log('✓ Found via fallback:', comm.subject?.substring(0, 40));
    }
  }

  if (!externalId) {
    console.log('\n✗ No external_id found - cannot tag email');
    console.log('\nTrying to find ANY communication with external_id for testing...');

    const { data: anyComm } = await supabase
      .from('communications')
      .select('id, external_id, subject, direction')
      .not('external_id', 'is', null)
      .eq('direction', 'inbound')
      .limit(1)
      .single();

    if (anyComm) {
      console.log('\nFound test communication:');
      console.log('  Subject:', anyComm.subject);
      console.log('  external_id:', anyComm.external_id?.substring(0, 50) + '...');
      externalId = anyComm.external_id;
      console.log('\nUsing this for test tagging...');
    } else {
      console.log('\nNo communications with external_id found at all.');
      return;
    }
  }

  // Now try to tag
  console.log('\n--- Attempting to tag email ---');
  console.log('external_id:', externalId?.substring(0, 50) + '...');

  // Get Microsoft connection
  const { data: msConnection } = await supabase
    .from('microsoft_connections')
    .select('user_id')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!msConnection) {
    console.log('✗ No active Microsoft connection');
    return;
  }

  console.log('Microsoft user_id:', msConnection.user_id);

  // Get token
  const token = await getValidToken(msConnection.user_id);
  if (!token) {
    console.log('✗ No valid token');
    return;
  }

  console.log('✓ Got valid token');

  // Try to tag
  try {
    const graphClient = new MicrosoftGraphClient(token);
    await graphClient.addCategoryToMessage(externalId!, 'X-FORCE');
    console.log('\n✓ SUCCESS! Added X-FORCE category to email');
    console.log('\nCheck Outlook to verify the category appears on the email.');
  } catch (err) {
    console.log('\n✗ Error tagging:', err);
  }
}

testTagging().catch(console.error);
