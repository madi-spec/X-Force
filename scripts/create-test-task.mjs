import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTestTask() {
  // Get a deal to link the task to
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, company_id')
    .limit(1);

  const deal = deals?.[0];
  
  if (!deal) {
    console.log('No deals found. Creating task without deal link...');
  } else {
    console.log('Found deal:', deal.name);
  }

  // Get a user to assign the task to
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .limit(1);

  const user = users?.[0];
  if (!user) {
    console.error('No users found!');
    return;
  }

  // Create the test task
  const taskData = {
    title: 'Send follow-up email to discuss pricing',
    description: 'Follow up with the prospect about our pricing options and address any questions they had from the demo.',
    type: 'email',
    priority: 'high',
    source: 'ai_recommendation',
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Due tomorrow
    assigned_to: user.id,
    deal_id: deal?.id || null,
    company_id: deal?.company_id || null,
  };

  const { data: task, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return;
  }

  console.log('Created test email task:');
  console.log('  ID:', task.id);
  console.log('  Title:', task.title);
  console.log('  Type:', task.type);
  console.log('  Priority:', task.priority);
  console.log('  Due:', task.due_at);
  console.log('\nGo to http://localhost:3000/tasks to test it!');
}

createTestTask();
