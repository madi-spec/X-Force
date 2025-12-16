import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const dealId = process.argv[2] || '9083d69f-99f0-43a1-a34d-293cc9ae28a5';

console.log('Testing deal fetch for:', dealId);

const { data: deal, error } = await supabase
  .from('deals')
  .select('id, name, stage')
  .eq('id', dealId)
  .single();

if (error) {
  console.error('Error:', error.message);
} else {
  console.log('Deal found:', deal);
}
