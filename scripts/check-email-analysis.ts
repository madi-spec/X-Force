import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check communications table columns
  const { data: comm } = await supabase
    .from('communications')
    .select('*')
    .eq('awaiting_our_response', true)
    .limit(1)
    .single();

  if (comm) {
    console.log('Communications table columns:');
    console.log(Object.keys(comm));
    console.log('\nSample values:');
    console.log('  subject:', comm.subject);
    console.log('  analysis_status:', comm.analysis_status);
    console.log('  current_analysis_id:', comm.current_analysis_id);
  }

  // Check if there's a communication_analysis table
  const { data: analysis, error } = await supabase
    .from('communication_analysis')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.log('\ncommunication_analysis table error:', error.message);
  } else {
    console.log('\ncommunication_analysis columns:');
    console.log(Object.keys(analysis || {}));
  }

  // Check email_analysis table
  const { data: emailAnalysis, error: eaError } = await supabase
    .from('email_analysis')
    .select('*')
    .limit(1)
    .single();

  if (eaError) {
    console.log('\nemail_analysis table error:', eaError.message);
  } else {
    console.log('\nemail_analysis columns:');
    console.log(Object.keys(emailAnalysis || {}));
    console.log('\nSample email_analysis:');
    console.log('  summary:', emailAnalysis?.summary?.substring?.(0, 100));
    console.log('  sentiment:', emailAnalysis?.sentiment);
    console.log('  key_points:', emailAnalysis?.key_points);
  }
}

check().catch(console.error);
