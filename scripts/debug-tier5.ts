/**
 * Debug Tier 5 - Why no items?
 */

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
  console.log('DEBUG TIER 5 CONDITIONS');
  console.log('='.repeat(70));

  const now = new Date();

  // ===========================================
  // CHECK 1: Cold leads (buying signals + 30+ days no contact)
  // ===========================================
  console.log('\n--- CHECK 1: Cold Leads (30+ days no contact + buying signals) ---\n');

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('company_id, signals, metrics')
    .not('company_id', 'is', null);

  let coldLeadCandidates = 0;
  const coldLeadDetails: any[] = [];

  for (const ri of riRecords || []) {
    const daysSinceContact = ri.metrics?.days_since_last_contact;
    const hasBuyingSignals = (ri.signals?.buying_signals || []).length > 0;
    const buyingSignalCount = (ri.signals?.buying_signals || []).length;

    if (hasBuyingSignals && daysSinceContact !== null && daysSinceContact >= 30) {
      coldLeadCandidates++;
      coldLeadDetails.push({ company_id: ri.company_id, daysSinceContact, buyingSignalCount });
    }

    // Also check if we're close to 30 days
    if (hasBuyingSignals && daysSinceContact !== null && daysSinceContact >= 20) {
      console.log(`  Near cold lead: days=${daysSinceContact}, signals=${buyingSignalCount}`);
    }
  }

  console.log(`Cold lead candidates (30+ days): ${coldLeadCandidates}`);
  if (coldLeadDetails.length > 0) {
    console.log('Details:', coldLeadDetails.slice(0, 5));
  }

  // Show distribution of days since contact
  const daysBuckets: Record<string, number> = { '0-7': 0, '8-14': 0, '15-29': 0, '30+': 0 };
  for (const ri of riRecords || []) {
    const days = ri.metrics?.days_since_last_contact;
    if (days === null || days === undefined) continue;
    if (days <= 7) daysBuckets['0-7']++;
    else if (days <= 14) daysBuckets['8-14']++;
    else if (days <= 29) daysBuckets['15-29']++;
    else daysBuckets['30+']++;
  }
  console.log('\nDays since contact distribution:', daysBuckets);

  // ===========================================
  // CHECK 2: New contacts without outreach
  // ===========================================
  console.log('\n--- CHECK 2: New Contacts Without Outreach (last 30 days) ---\n');

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { data: newContacts } = await supabase
    .from('contacts')
    .select('id, name, email, company_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  console.log(`New contacts in last 30 days: ${newContacts?.length || 0}`);

  let noOutreachCount = 0;
  for (const contact of (newContacts || []).slice(0, 10)) {
    if (!contact.email) continue;

    const { data: outboundEmails } = await supabase
      .from('email_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('is_sent_by_user', true)
      .ilike('to_email', `%${contact.email}%`)
      .limit(1)
      .single();

    if (!outboundEmails) {
      noOutreachCount++;
      console.log(`  No outreach: ${contact.name} (${contact.email})`);
    }
  }
  console.log(`\nContacts without outreach (first 10 checked): ${noOutreachCount}`);

  // ===========================================
  // CHECK 3: Companies needing research
  // ===========================================
  console.log('\n--- CHECK 3: Companies Needing Research ---\n');

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain, intelligence_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  console.log(`Total companies checked: ${companies?.length || 0}`);

  let minimalDataCount = 0;
  for (const company of companies || []) {
    const keyCount = Object.keys(company.intelligence_data || {}).length;
    if (keyCount < 3) {
      minimalDataCount++;
      console.log(`  Minimal data (${keyCount} keys): ${company.name || company.domain}`);
    }
  }
  console.log(`\nCompanies with minimal intelligence_data (<3 keys): ${minimalDataCount}`);

  // ===========================================
  // CHECK 4: Look at actual data
  // ===========================================
  console.log('\n--- Sample Company Intelligence Data ---\n');

  for (const company of (companies || []).slice(0, 3)) {
    console.log(`${company.name || company.domain}:`);
    console.log(`  Keys: ${Object.keys(company.intelligence_data || {}).join(', ') || 'none'}`);
    console.log();
  }

  console.log('='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
