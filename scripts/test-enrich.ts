import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const itemId = 'dbea2488-a714-43f1-96d5-21469bf9e9f4';
  const userId = '11111111-1111-1111-1111-111111111009';

  // Get the item with related data
  const { data: item, error } = await supabase
    .from('command_center_items')
    .select(`
      *,
      deal:deals(id, name, stage, estimated_value),
      company:companies(id, name),
      contact:contacts(id, name, email, title)
    `)
    .eq('id', itemId)
    .single();

  if (error) {
    console.error('Error fetching item:', error);
    return;
  }

  console.log('Item to enrich:');
  console.log('  Title:', item.title);
  console.log('  Action Type:', item.action_type);
  console.log('  Deal:', item.deal?.name || 'None');
  console.log('  Company:', item.company?.name || 'None');
  console.log('  Contact:', item.contact?.name || 'None');

  // Import and call enrichItem
  const { enrichItem } = await import('../src/lib/commandCenter/contextEnrichment');

  console.log('\nCalling enrichItem...');
  const enrichment = await enrichItem(userId, item);

  console.log('\nEnrichment result:');
  console.log(JSON.stringify(enrichment, null, 2));

  // Save to database
  const { error: updateError } = await supabase
    .from('command_center_items')
    .update({
      context_summary: enrichment.context_summary,
      considerations: enrichment.considerations,
      source_links: enrichment.source_links,
      primary_contact: enrichment.primary_contact,
      email_draft: enrichment.email_draft,
      schedule_suggestions: enrichment.schedule_suggestions,
      available_actions: enrichment.available_actions,
    })
    .eq('id', itemId);

  if (updateError) {
    console.error('\nFailed to save:', updateError);
  } else {
    console.log('\n✓ Enrichment saved to database');

    // Verify
    const { data: updated } = await supabase
      .from('command_center_items')
      .select('context_summary, considerations')
      .eq('id', itemId)
      .single();

    console.log('Verified in DB:');
    console.log('  context_summary:', updated?.context_summary?.substring(0, 80) + '...');
    console.log('  considerations:', updated?.considerations?.length, 'items');
  }
}

test().catch(console.error);
