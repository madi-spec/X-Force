import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyMigration() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  console.log('Applying action_items migration...');

  // Check if table exists
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'action_items');

  if (tables && tables.length > 0) {
    console.log('action_items table already exists');
    return;
  }

  // Create action_items table using raw SQL via RPC
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS action_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
        transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL,
        text TEXT NOT NULL,
        assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
        due_date DATE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
        completed_at TIMESTAMPTZ,
        completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        source TEXT DEFAULT 'manual' CHECK (source IN ('ai_generated', 'manual')),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_action_items_user ON action_items(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_action_items_activity ON action_items(activity_id) WHERE activity_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_action_items_transcription ON action_items(transcription_id) WHERE transcription_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_action_items_assignee ON action_items(assignee_id, status) WHERE assignee_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(user_id, status);

      ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Users can view action items they own or are assigned"
        ON action_items FOR SELECT
        USING (
          auth.uid() IN (SELECT auth_id FROM users WHERE id = action_items.user_id)
          OR auth.uid() IN (SELECT auth_id FROM users WHERE id = action_items.assignee_id)
        );

      CREATE POLICY "Users can insert their own action items"
        ON action_items FOR INSERT
        WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

      CREATE POLICY "Users can update action items they own or are assigned"
        ON action_items FOR UPDATE
        USING (
          auth.uid() IN (SELECT auth_id FROM users WHERE id = action_items.user_id)
          OR auth.uid() IN (SELECT auth_id FROM users WHERE id = action_items.assignee_id)
        );

      CREATE POLICY "Users can delete their own action items"
        ON action_items FOR DELETE
        USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = action_items.user_id));
    `
  });

  if (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }

  console.log('Migration applied successfully!');
}

applyMigration().catch(console.error);
