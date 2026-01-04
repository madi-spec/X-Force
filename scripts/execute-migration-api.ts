/**
 * Execute migration via Supabase Management API
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'nezewucpbkuzoukomnlv';

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const migrationStatements = [
  // Activities
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_activities_company_product_id ON activities(company_product_id)`,

  // Tasks
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_company_product_id ON tasks(company_product_id)`,

  // Meeting transcriptions
  `ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_company_product_id ON meeting_transcriptions(company_product_id)`,

  // Scheduling requests
  `ALTER TABLE scheduling_requests ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_scheduling_requests_company_product_id ON scheduling_requests(company_product_id)`,

  // Command center items
  `ALTER TABLE command_center_items ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_command_center_items_company_product_id ON command_center_items(company_product_id)`,

  // AI email drafts (check if column doesn't exist first handled by IF NOT EXISTS)
  `ALTER TABLE ai_email_drafts ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_ai_email_drafts_company_product_id ON ai_email_drafts(company_product_id)`,

  // AI signals
  `ALTER TABLE ai_signals ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_ai_signals_company_product_id ON ai_signals(company_product_id)`,

  // Communications
  `ALTER TABLE communications ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_communications_company_product_id ON communications(company_product_id)`,
];

async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `${response.status}: ${errorText}` };
  }

  return { success: true };
}

async function main() {
  console.log('🚀 Executing migration via Supabase API...\n');

  let success = 0;
  let failed = 0;

  for (const sql of migrationStatements) {
    const shortSql = sql.length > 60 ? sql.substring(0, 60) + '...' : sql;
    process.stdout.write(`  Running: ${shortSql}`);

    const result = await executeSQL(sql);

    if (result.success) {
      console.log(' ✓');
      success++;
    } else {
      console.log(` ❌ ${result.error}`);
      failed++;
    }
  }

  console.log(`\n✓ Success: ${success}, ❌ Failed: ${failed}`);
}

main().catch(console.error);
