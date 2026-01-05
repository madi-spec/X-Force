import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateMigrationStatus() {
  // Get migration product
  const { data: migrationProduct } = await supabase
    .from('products')
    .select('id')
    .eq('slug', 'xrai-migration')
    .single();

  if (!migrationProduct) {
    console.log('Migration product not found');
    return;
  }

  // Update all migration company_products to 'active' status
  // They start as active customers (not in pipeline) until we reach out
  const { data: updated, error } = await supabase
    .from('company_products')
    .update({
      status: 'active',
      current_stage_id: null, // Not in a stage yet
      stage_entered_at: null,
      activated_at: new Date().toISOString(),
      notes: 'X-RAI 1.0 customer - pending migration outreach'
    })
    .eq('product_id', migrationProduct.id)
    .eq('status', 'in_sales')
    .select();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log(`Updated ${updated?.length || 0} migration customers to 'active' status`);
  console.log('They will move to "Engaging" stage when you reach out to them.');
}

updateMigrationStatus();
