import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const userId = '11111111-1111-1111-1111-111111111009';

  // Find an item that should generate an email draft
  // Email drafts are generated for: email_send_draft, email_compose, email_respond, meeting_follow_up
  const { data: items, error } = await supabase
    .from('command_center_items')
    .select(`
      id,
      title,
      action_type,
      target_name,
      company_name,
      email_draft,
      deal:deals(id, name, stage),
      company:companies(id, name),
      contact:contacts(id, name, email)
    `)
    .eq('user_id', userId)
    .in('action_type', ['email_send_draft', 'email_compose', 'email_respond', 'meeting_follow_up'])
    .limit(5);

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  console.log(`Found ${items?.length || 0} items with email-generating action types:\n`);

  if (!items || items.length === 0) {
    // Fall back to any item with a contact
    console.log('No email-type actions found. Looking for any item with a contact...');
    const { data: anyItems } = await supabase
      .from('command_center_items')
      .select(`
        id,
        title,
        action_type,
        target_name,
        company_name,
        email_draft,
        contact:contacts(id, name, email)
      `)
      .eq('user_id', userId)
      .not('contact_id', 'is', null)
      .limit(5);

    if (!anyItems || anyItems.length === 0) {
      console.log('No items with contacts found. Cannot test email generation.');
      return;
    }

    console.log('Found items with contacts:');
    for (const item of anyItems) {
      console.log(`  - ${item.title} (${item.action_type}) → ${item.contact?.name || 'No contact'}`);
    }
    return;
  }

  for (const item of items) {
    console.log(`Item: ${item.title}`);
    console.log(`  Action Type: ${item.action_type}`);
    console.log(`  Target: ${item.target_name || 'None'}`);
    console.log(`  Company: ${item.company_name || item.company?.name || 'None'}`);
    console.log(`  Contact: ${item.contact?.name || 'None'} <${item.contact?.email || 'no email'}>`);
    console.log(`  Has Draft: ${item.email_draft ? 'Yes' : 'No'}`);
    if (item.email_draft) {
      console.log(`    Subject: ${item.email_draft.subject}`);
      console.log(`    Confidence: ${item.email_draft.confidence}%`);
    }
    console.log('');
  }

  // Test regenerating a draft for the first item
  const testItem = items[0];
  console.log('='.repeat(60));
  console.log(`Testing email draft generation for: ${testItem.title}`);
  console.log('='.repeat(60));

  // Import and call regenerateEmailDraft
  const { regenerateEmailDraft } = await import('../src/lib/commandCenter/contextEnrichment');

  console.log('\nCalling regenerateEmailDraft...');
  const startTime = Date.now();

  try {
    const draft = await regenerateEmailDraft(userId, testItem.id);
    const elapsed = Date.now() - startTime;

    console.log(`\n✓ Email draft generated in ${elapsed}ms\n`);
    console.log('Subject:', draft.subject);
    console.log('Confidence:', `${draft.confidence}%`);
    console.log('Generated At:', draft.generated_at);
    console.log('\nBody:');
    console.log('-'.repeat(40));
    console.log(draft.body);
    console.log('-'.repeat(40));

    // Verify saved to database
    const { data: updated } = await supabase
      .from('command_center_items')
      .select('email_draft')
      .eq('id', testItem.id)
      .single();

    if (updated?.email_draft?.subject === draft.subject) {
      console.log('\n✓ Draft saved to database successfully');
    } else {
      console.log('\n✗ Draft not saved to database');
    }
  } catch (err) {
    console.error('\nError generating draft:', err);
  }
}

test().catch(console.error);
