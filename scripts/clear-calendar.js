// Quick script to clear and re-sync calendar events
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

async function clearAndSync() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('Deleting Microsoft calendar events...');

  // Delete activities with external_id starting with 'ms_event_'
  const { data: deleted, error: deleteError } = await supabase
    .from('activities')
    .delete()
    .like('external_id', 'ms_event_%')
    .select('id');

  if (deleteError) {
    console.error('Delete error:', deleteError);
    return;
  }

  console.log('Deleted ' + (deleted ? deleted.length : 0) + ' calendar events');
  console.log('Now trigger sync from the app or run: curl -X POST http://localhost:3000/api/microsoft/sync');
}

clearAndSync();
