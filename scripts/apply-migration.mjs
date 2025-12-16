/**
 * Apply Activity Matching Migration via Supabase REST API
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeSql(sql) {
  // Use the Supabase SQL endpoint
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SQL execution failed: ${text}`);
  }

  return response.json();
}

async function runMigration() {
  console.log('Applying activity matching migration...\n');

  const statements = [
    {
      name: 'Add match_status column',
      sql: "ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending'",
    },
    {
      name: 'Add match_confidence column',
      sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(3,2)',
    },
    {
      name: 'Add match_reasoning column',
      sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_reasoning TEXT',
    },
    {
      name: 'Add matched_at column',
      sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ',
    },
    {
      name: 'Add exclude_reason column',
      sql: 'ALTER TABLE activities ADD COLUMN IF NOT EXISTS exclude_reason TEXT',
    },
    {
      name: 'Create match_status index',
      sql: 'CREATE INDEX IF NOT EXISTS idx_activities_match_status ON activities(match_status)',
    },
  ];

  let success = true;

  for (const stmt of statements) {
    process.stdout.write(`${stmt.name}... `);
    try {
      await executeSql(stmt.sql);
      console.log('OK');
    } catch (error) {
      // Check if it's just a "function not found" error
      if (error.message.includes('function') || error.message.includes('exec_sql')) {
        console.log('SKIP (needs manual SQL)');
        success = false;
      } else {
        console.log(`ERROR: ${error.message}`);
        success = false;
      }
    }
  }

  if (!success) {
    console.log('\n========================================');
    console.log('MANUAL SQL REQUIRED');
    console.log('========================================');
    console.log('Run this in Supabase SQL Editor:\n');
    console.log(`
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(3,2);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_reasoning TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS exclude_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_activities_match_status ON activities(match_status);
`);
  }

  return success;
}

runMigration().catch(console.error);
