import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const supabase = createAdminClient();

  // Try to query the tables
  const { error: riError, count: riCount } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true });

  const { error: rnError, count: rnCount } = await supabase
    .from('relationship_notes')
    .select('*', { count: 'exact', head: true });

  console.log('Table status:');
  if (riError) {
    console.log('  relationship_intelligence: NOT FOUND -', riError.message);
  } else {
    console.log('  relationship_intelligence: EXISTS with', riCount, 'records');
  }

  if (rnError) {
    console.log('  relationship_notes: NOT FOUND -', rnError.message);
  } else {
    console.log('  relationship_notes: EXISTS with', rnCount, 'records');
  }
}
main().catch(console.error);
