/**
 * List review tasks created by the PST matching script
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTasks() {
  const { data: tasks, error, count } = await supabase
    .from('tasks')
    .select('id, title, priority, due_at, description', { count: 'exact' })
    .eq('source', 'ai_recommendation')
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`\nReview Tasks (${count} total, showing ${tasks.length}):`);
  console.log('='.repeat(70));

  tasks.forEach((t, i) => {
    console.log(`\n${i + 1}. ${t.title}`);
    console.log(`   Priority: ${t.priority} | Due: ${t.due_at?.split('T')[0] || 'N/A'}`);
    // Extract AI reasoning from description
    const reasonMatch = t.description?.match(/\*\*AI Analysis:\*\* (.+)/);
    if (reasonMatch) {
      console.log(`   AI Analysis: ${reasonMatch[1].slice(0, 60)}...`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Total review tasks pending: ${count}`);
  console.log('\nView all tasks at: http://localhost:3000/tasks');
}

listTasks();
