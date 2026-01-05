import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';

async function main() {
  console.log('='.repeat(70));
  console.log('DEBUG TIER 5 v2');
  console.log('='.repeat(70));

  // Get user's company IDs from deals
  const { data: userDeals } = await supabase
    .from('deals')
    .select('company_id')
    .eq('user_id', userId)
    .not('company_id', 'is', null);

  const userCompanyIds = [...new Set((userDeals || []).map(d => d.company_id).filter(Boolean))];
  console.log(`\nUser's company IDs (from deals): ${userCompanyIds.length}`);

  // Check companies with intelligence_data
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain, intelligence_data')
    .in('id', userCompanyIds)
    .limit(10);

  console.log('\n--- Company Intelligence Data ---\n');
  let minimalCount = 0;
  for (const company of companies || []) {
    const keys = Object.keys(company.intelligence_data || {});
    console.log(`${company.name}: ${keys.length} keys`);
    if (keys.length < 3) {
      minimalCount++;
      console.log(`  ^^ MINIMAL (< 3 keys)`);
    }
  }
  console.log(`\nCompanies with minimal data: ${minimalCount}`);

  // Check contacts for these companies
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { data: newContacts } = await supabase
    .from('contacts')
    .select('id, name, email, company_id, created_at')
    .in('company_id', userCompanyIds)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n--- New Contacts (last 30 days) ---\n');
  console.log(`Found: ${newContacts?.length || 0}`);
  for (const contact of newContacts || []) {
    console.log(`  ${contact.name} (${contact.email}) - created ${contact.created_at}`);
  }

  // Check RI records for last_interaction_date
  console.log('\n--- RI Metrics (last_interaction_date) ---\n');
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('company_id, signals, metrics')
    .not('company_id', 'is', null)
    .limit(10);

  for (const ri of riRecords || []) {
    const hasBuyingSignals = (ri.signals?.buying_signals || []).length > 0;
    const lastInteraction = ri.metrics?.last_interaction_date;
    console.log(`  Company ${ri.company_id?.substring(0, 8)}:`);
    console.log(`    buying_signals: ${hasBuyingSignals ? (ri.signals?.buying_signals || []).length : 0}`);
    console.log(`    last_interaction_date: ${lastInteraction || 'NOT SET'}`);
    if (ri.metrics) {
      console.log(`    metrics keys: ${Object.keys(ri.metrics).join(', ')}`);
    }
  }

  // Check what metrics keys are actually available
  console.log('\n--- RI Metrics Structure ---\n');
  const sampleRi = (riRecords || [])[0];
  if (sampleRi?.metrics) {
    console.log('Sample metrics object:', JSON.stringify(sampleRi.metrics, null, 2));
  }

  // Check interactions field
  console.log('\n--- RI Interactions Field ---\n');
  const { data: riWithInteractions } = await supabase
    .from('relationship_intelligence')
    .select('company_id, interactions')
    .not('interactions', 'is', null)
    .limit(3);

  for (const ri of riWithInteractions || []) {
    const interactions = ri.interactions || [];
    console.log(`Company ${ri.company_id?.substring(0, 8)}: ${interactions.length} interactions`);
    if (interactions.length > 0) {
      const lastInteraction = interactions[interactions.length - 1];
      console.log(`  Last interaction: ${lastInteraction.date} - ${lastInteraction.type}`);
    }
  }

  console.log('\n='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
