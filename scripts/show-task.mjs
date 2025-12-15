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

async function main() {
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('source', 'fireflies_ai')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (task) {
    console.log('=== Review Task ===\n');
    console.log('Title:', task.title);
    console.log('Priority:', task.priority);
    console.log('Due:', task.due_at);
    console.log('\n--- Description ---\n');
    console.log(task.description);
  }
}

main().catch(console.error);
