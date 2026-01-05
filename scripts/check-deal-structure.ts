import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== Deal Structure Check ===\n');

  // Check deals table columns
  const { data: deal, error: dealErr } = await supabase.from('deals').select('*').limit(1).single();
  if (dealErr) {
    console.log('Deal error:', dealErr.message);
  } else {
    console.log('Deal columns:', Object.keys(deal || {}));
  }

  // Check if activities table has deal_id
  const { data: act, error: actErr } = await supabase.from('activities').select('*').limit(1).single();
  if (actErr) {
    console.log('Activity error:', actErr.message);
  } else {
    console.log('\nActivity columns:', Object.keys(act || {}));
  }

  // Check communications for deal_id
  const { data: comm, error: commErr } = await supabase.from('communications').select('*').limit(1).single();
  if (commErr) {
    console.log('Communication error:', commErr.message);
  } else {
    console.log('\nCommunication columns:', Object.keys(comm || {}));
  }

  // Check meeting_transcriptions
  const { data: meeting, error: meetErr } = await supabase.from('meeting_transcriptions').select('*').limit(1).single();
  if (meetErr) {
    console.log('Meeting error:', meetErr.message);
  } else {
    console.log('\nMeeting columns:', Object.keys(meeting || {}));
  }

  // Check company_products structure
  const { data: cp, error: cpErr } = await supabase.from('company_products').select('*').limit(1).single();
  if (cpErr) {
    console.log('CompanyProduct error:', cpErr.message);
  } else {
    console.log('\nCompanyProduct columns:', Object.keys(cp || {}));
  }

  // Check a sample deal with related data
  console.log('\n\n=== Sample Deal with Relations ===');
  const { data: sampleDeal } = await supabase
    .from('deals')
    .select('id, name, company_id, stage, created_at')
    .limit(1)
    .single();

  if (sampleDeal) {
    console.log('Deal:', sampleDeal.name);

    // Count activities for this deal
    const { count: actCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('deal_id', sampleDeal.id);
    console.log('Activities linked:', actCount);

    // Count communications for this company
    const { count: commCount } = await supabase
      .from('communications')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', sampleDeal.company_id);
    console.log('Communications (company):', commCount);

    // Count meetings for this company
    const { count: meetCount } = await supabase
      .from('meeting_transcriptions')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', sampleDeal.company_id);
    console.log('Meetings (company):', meetCount);
  }
}

main().catch(console.error);
