import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  // The company_id from the communications with external_id
  const companyId = '26f38faf-fe7f-402b-a827-6c3307a27b8f';

  // Find command center items for this company
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, title, status, source, company_id')
    .eq('company_id', companyId)
    .limit(5);

  console.log('CC items for company', companyId, ':', ccItems?.length || 0);
  ccItems?.forEach(i => {
    console.log('  -', i.status, i.title?.substring(0, 40));
  });

  // Check company name
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single();

  console.log('\nCompany name:', company?.name);

  // Get the communication we can test with
  const { data: comm } = await supabase
    .from('communications')
    .select('id, external_id, subject')
    .eq('company_id', companyId)
    .not('external_id', 'is', null)
    .single();

  if (comm) {
    console.log('\nTest communication:');
    console.log('  ID:', comm.id);
    console.log('  Subject:', comm.subject);
    console.log('  external_id:', comm.external_id?.substring(0, 50) + '...');
  }
}

find().catch(console.error);
