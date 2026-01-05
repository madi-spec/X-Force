import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeDuplicates() {
  // Get all companies
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, vfp_customer_id, external_ids, status')
    .order('name');

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('Total companies:', companies.length);

  // Find potential duplicates by similar names
  const nameMap = new Map<string, typeof companies>();
  companies.forEach(c => {
    // Normalize name for comparison - remove common suffixes and special chars
    const normalized = c.name.toLowerCase()
      .replace(/\s*-\s*(corporate|corp|va|nc|sc|ga|fl|tx|ca|ny|oh|pa|il|az|nv|co|wa|or|ma|ct|nj|md|tn|ky|al|la|mo|mn|wi|ia|ks|ok|ar|ms|ut|ne|nm|wv|id|hi|me|nh|ri|mt|de|sd|nd|ak|vt|wy|dc)\s*$/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .replace(/(inc|llc|corp|company|co|services|service)$/g, '');

    if (!nameMap.has(normalized)) {
      nameMap.set(normalized, []);
    }
    nameMap.get(normalized)!.push(c);
  });

  // Show duplicates
  let dupeCount = 0;
  const dupeGroups: Array<{ normalized: string; companies: typeof companies }> = [];

  nameMap.forEach((list, name) => {
    if (list.length > 1) {
      dupeCount++;
      dupeGroups.push({ normalized: name, companies: list });
    }
  });

  console.log('\n--- Potential duplicates (by normalized name) ---');
  console.log('Total duplicate groups:', dupeCount);

  // Show first 20 duplicate groups
  dupeGroups.slice(0, 20).forEach(group => {
    console.log('\nDuplicate group (' + group.normalized + '):');
    group.companies.forEach(c => {
      const extIds = c.external_ids ? JSON.stringify(c.external_ids) : 'none';
      console.log(`  - ${c.name}`);
      console.log(`    Rev ID: ${c.vfp_customer_id || 'none'}, Status: ${c.status}, External: ${extIds}`);
    });
  });

  // Stats
  const withRevId = companies.filter(c => c.vfp_customer_id);
  const withoutRevId = companies.filter(c => !c.vfp_customer_id);
  console.log('\n--- Stats ---');
  console.log('Companies with Rev ID:', withRevId.length);
  console.log('Companies without Rev ID:', withoutRevId.length);

  // Check external_ids field
  const withExternalIds = companies.filter(c => c.external_ids && Object.keys(c.external_ids).length > 0);
  console.log('Companies with external_ids:', withExternalIds.length);
  if (withExternalIds.length > 0) {
    console.log('Sample external_ids:', JSON.stringify(withExternalIds[0].external_ids));
  }
}

analyzeDuplicates();
