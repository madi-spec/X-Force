import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== Applying Conversion Migration ===\n');

  // Check current state
  const { data: deal } = await supabase.from('deals').select('*').limit(1).single();
  const columns = Object.keys(deal || {});
  console.log('Current deal columns include converted_at:', columns.includes('converted_at'));

  // Try to add columns via RPC or direct SQL
  // Since we can't run DDL directly, let's check if we need the migration
  if (!columns.includes('converted_at')) {
    console.log('\nNeed to run migration manually. Execute this SQL in Supabase dashboard:\n');
    console.log(`
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS converted_to_company_product_ids UUID[] DEFAULT NULL;

ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS converted_from_deal_id UUID REFERENCES deals(id);

CREATE TABLE IF NOT EXISTS deal_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_deal_id UUID NOT NULL REFERENCES deals(id),
  company_product_id UUID NOT NULL REFERENCES company_products(id),
  product_id UUID NOT NULL REFERENCES products(id),
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_by UUID REFERENCES users(id),
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  activities_count INT DEFAULT 0,
  communications_count INT DEFAULT 0,
  meetings_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(legacy_deal_id, product_id)
);

ALTER TABLE deal_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view deal conversions" ON deal_conversions FOR SELECT USING (true);
CREATE POLICY "Users can insert deal conversions" ON deal_conversions FOR INSERT WITH CHECK (true);
    `);
  } else {
    console.log('Columns already exist!');
  }

  // Check deal_conversions table
  const { error: dcError } = await supabase.from('deal_conversions').select('id').limit(1);
  if (dcError && dcError.message.includes('does not exist')) {
    console.log('\ndeal_conversions table does not exist - needs migration');
  } else {
    console.log('\ndeal_conversions table exists');
  }

  // Check company_products for converted_from_deal_id
  const { data: cp } = await supabase.from('company_products').select('*').limit(1).single();
  const cpColumns = Object.keys(cp || {});
  console.log('company_products has converted_from_deal_id:', cpColumns.includes('converted_from_deal_id'));
}

main().catch(console.error);
