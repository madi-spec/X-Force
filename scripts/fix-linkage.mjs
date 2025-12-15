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

async function fixLinkage() {
  console.log('=== Fixing Transcript Linkages ===\n');

  // 1. Fix Hoffer - link to deal
  console.log('1. Fixing Hoffer...');
  const { data: hofferDeal } = await supabase
    .from('deals')
    .select('id, name')
    .ilike('name', '%Hoffer%')
    .single();

  const { data: hofferTranscript } = await supabase
    .from('meeting_transcriptions')
    .select('id, title')
    .ilike('title', '%Hoffer%')
    .single();

  if (hofferDeal && hofferTranscript) {
    await supabase
      .from('meeting_transcriptions')
      .update({ deal_id: hofferDeal.id })
      .eq('id', hofferTranscript.id);
    console.log('   Linked "' + hofferTranscript.title + '" to deal "' + hofferDeal.name + '"');
  }

  // 2. Fix Happinest AI Conversation - link to correct company/deal
  console.log('\n2. Fixing Happinest AI Conversation...');
  const { data: happinestCompany } = await supabase
    .from('companies')
    .select('id, name')
    .eq('name', 'Happinest')
    .single();

  const { data: happinestDeal } = await supabase
    .from('deals')
    .select('id, name')
    .eq('name', 'Happinest')
    .single();

  const { data: happinestTranscript } = await supabase
    .from('meeting_transcriptions')
    .select('id, title')
    .eq('title', 'Happinest AI Conversation')
    .single();

  if (happinestCompany && happinestDeal && happinestTranscript) {
    await supabase
      .from('meeting_transcriptions')
      .update({
        company_id: happinestCompany.id,
        deal_id: happinestDeal.id
      })
      .eq('id', happinestTranscript.id);
    console.log('   Linked "' + happinestTranscript.title + '" to company "' + happinestCompany.name + '" and deal "' + happinestDeal.name + '"');
  }

  console.log('\n=== Done ===');
}

fixLinkage().catch(console.error);
