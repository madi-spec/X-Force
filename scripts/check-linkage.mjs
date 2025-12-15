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

async function checkLinkage() {
  const names = ['Blue Beetle', 'Hoffer', 'Happinest'];

  for (const name of names) {
    console.log(`\n=== ${name} ===`);

    // Find transcripts
    const { data: transcripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, company_id, deal_id')
      .or(`title.ilike.%${name}%`);

    if (!transcripts?.length) {
      console.log('No transcripts found');
      continue;
    }

    for (const t of transcripts) {
      console.log('\nTranscript:', t.title);
      console.log('  company_id:', t.company_id || 'NULL');
      console.log('  deal_id:', t.deal_id || 'NULL');

      if (t.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', t.company_id)
          .single();
        console.log('  -> Company:', company?.name || 'NOT FOUND');
      }

      if (t.deal_id) {
        const { data: deal } = await supabase
          .from('deals')
          .select('id, name')
          .eq('id', t.deal_id)
          .single();
        console.log('  -> Deal:', deal?.name || 'NOT FOUND');
      }
    }

    // Also check if there are deals for this company
    const { data: deals } = await supabase
      .from('deals')
      .select('id, name, company:companies(name)')
      .or(`name.ilike.%${name}%`);

    if (deals?.length) {
      console.log('\nDeals matching "' + name + '":');
      deals.forEach(d => console.log('  -', d.name, '(Company:', d.company?.name || 'none', ')'));
    }

    // Check companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${name}%`);

    if (companies?.length) {
      console.log('\nCompanies matching "' + name + '":');
      companies.forEach(c => console.log('  -', c.name, '(ID:', c.id, ')'));
    }
  }
}

checkLinkage().catch(console.error);
