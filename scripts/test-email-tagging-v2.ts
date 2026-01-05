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
  console.log('=== Testing Email Tagging Logic v2 ===\n');

  // Get an email_inbound command center item with email_id
  const { data: item, error } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, conversation_id, company_id, contact_id')
    .eq('source', 'email_inbound')
    .eq('status', 'pending')
    .not('email_id', 'is', null)
    .limit(1)
    .single();

  if (error || !item) {
    console.log('No email_inbound item with email_id found');

    // Try any email_inbound item
    const { data: anyItem } = await supabase
      .from('command_center_items')
      .select('id, title, source, source_id, email_id, conversation_id, company_id, contact_id')
      .eq('source', 'email_inbound')
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (!anyItem) {
      console.log('No email_inbound items at all');
      return;
    }

    console.log('Using item without email_id:');
    console.log('  ID:', anyItem.id);
    console.log('  email_id:', anyItem.email_id);
    console.log('  source_id:', anyItem.source_id);
    return;
  }

  console.log('Test item:');
  console.log('  ID:', item.id);
  console.log('  Title:', item.title?.substring(0, 50));
  console.log('  email_id:', item.email_id);
  console.log('  source_id:', item.source_id);

  // Try to find external_id using email_id -> communications link
  let externalId: string | null = null;
  const emailMessageId = item.email_id || item.source_id;

  if (emailMessageId) {
    console.log('\nLooking up communication via email_messages link...');
    console.log('  email_messages.id:', emailMessageId);

    const { data: comm, error: commError } = await supabase
      .from('communications')
      .select('id, external_id, subject')
      .eq('source_table', 'email_messages')
      .eq('source_id', emailMessageId)
      .single();

    if (commError) {
      console.log('  Error:', commError.message);
    } else if (comm?.external_id) {
      externalId = comm.external_id;
      console.log('  ✓ Found communication!');
      console.log('    Subject:', comm.subject?.substring(0, 40));
      console.log('    external_id:', comm.external_id.substring(0, 50) + '...');
    } else {
      console.log('  No communication found with this email_messages.id');
    }
  }

  if (!externalId) {
    console.log('\n✗ Could not find external_id via email_id link');
    return;
  }

  // Now try to tag
  console.log('\n--- Attempting to tag email ---');

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

  const token = await getValidToken(msConnection.user_id);
  if (!token) {
    console.log('✗ No valid token');
    return;
  }

  console.log('✓ Got valid token');

  try {
    const graphClient = new MicrosoftGraphClient(token);
    await graphClient.addCategoryToMessage(externalId, 'X-FORCE');
    console.log('\n✓ SUCCESS! Added X-FORCE category to email');
    console.log('\nCheck Outlook to verify the category appears on the email.');
  } catch (err) {
    console.log('\n✗ Error tagging:', err);
  }
}

testTagging().catch(console.error);
