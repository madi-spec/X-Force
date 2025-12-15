import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Get created company
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('name', 'Bug Busters USA')
    .single();

  console.log('=== Created Company ===');
  console.log('Name:', company?.name);
  console.log('Status:', company?.status);
  console.log('Industry:', company?.industry);
  console.log('Segment:', company?.segment);

  // Get contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', company?.id);

  console.log('\n=== Contacts ===');
  contacts?.forEach(c => {
    console.log('-', c.name, '|', c.email, '|', c.role, '| Primary:', c.is_primary);
  });

  // Get deal
  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('company_id', company?.id)
    .single();

  console.log('\n=== Created Deal ===');
  console.log('Name:', deal?.name);
  console.log('Stage:', deal?.stage);
  console.log('Type:', deal?.deal_type);
  console.log('Sales Team:', deal?.sales_team);
  console.log('Estimated Value: $' + deal?.estimated_value?.toLocaleString());
  console.log('Products:', deal?.quoted_products);
}

main().catch(console.error);
