import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running Phase 2b migration...\n');

  // Check if risk_score column exists by querying for it
  const { data: testData, error: testError } = await supabase
    .from('command_center_items')
    .select('id, risk_score')
    .limit(1);

  if (testError && testError.message.includes('risk_score')) {
    console.log('⚠️  risk_score column does not exist');
    console.log('   Please add it via Supabase dashboard SQL editor:');
    console.log('   ALTER TABLE command_center_items ADD COLUMN risk_score INTEGER DEFAULT 0;\n');
  } else {
    console.log('✅ risk_score column exists\n');
  }

  // Check if the unique index exists by trying to insert duplicate
  // First, let's just verify the table structure
  const { data: items, error: itemsError } = await supabase
    .from('command_center_items')
    .select('id, source, source_id, status')
    .eq('status', 'pending')
    .limit(5);

  if (itemsError) {
    console.log('❌ Error querying command_center_items:', itemsError.message);
  } else {
    console.log('✅ command_center_items table accessible');
    console.log(`   Found ${items?.length || 0} pending items\n`);
  }

  // Note about the index
  console.log('📝 To create the deduplication index, run in Supabase SQL editor:');
  console.log('   CREATE UNIQUE INDEX IF NOT EXISTS idx_cci_source_unique');
  console.log('   ON command_center_items(user_id, source, source_id)');
  console.log('   WHERE source_id IS NOT NULL AND status = \'pending\';\n');

  console.log('Migration check complete.');
}

runMigration().catch(console.error);
