/**
 * Test the deal summary API with database prompts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.error('Failed to load .env.local:', e.message);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('=== Testing Deal Summary with Database Prompts ===\n');

  // Check if the prompt exists in the database
  const { data: prompt, error: promptError } = await supabase
    .from('ai_prompts')
    .select('id, key, name, version')
    .eq('key', 'deal_summary')
    .single();

  if (promptError || !prompt) {
    console.log('❌ Deal summary prompt NOT found in database');
    console.log('   The summary will use the fallback inline prompt');
  } else {
    console.log('✓ Deal summary prompt found in database');
    console.log(`  Name: ${prompt.name}`);
    console.log(`  Version: ${prompt.version}`);
  }
  console.log('');

  // Get a deal
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, name, stage')
    .not('stage', 'in', '("closed_won","closed_lost")')
    .limit(1);

  if (dealsError || !deals || deals.length === 0) {
    console.log('No active deals found to test');
    return;
  }

  const deal = deals[0];
  console.log(`Testing with deal: ${deal.name}`);
  console.log(`  ID: ${deal.id}`);
  console.log(`  Stage: ${deal.stage}`);
  console.log('');

  // Call the API
  console.log('Calling API (force=true to regenerate)...');
  const startTime = Date.now();

  try {
    const res = await fetch(`http://localhost:3000/api/ai/summaries/deal/${deal.id}?force=true`);
    const data = await res.json();

    if (data.error) {
      console.log(`\n❌ Error: ${data.error}`);
      if (data.details) console.log(`   Details: ${data.details}`);
    } else {
      console.log(`\n✓ Summary generated successfully!`);
      console.log(`  Tokens used: ${data.tokensUsed}`);
      console.log(`  Latency: ${data.latencyMs}ms`);
      console.log(`  Is new: ${data.isNew}`);
      console.log('');
      console.log('--- Summary ---');
      console.log(`Headline: ${data.summary?.headline}`);
      console.log('');
      if (data.summary?.overview) {
        console.log('Overview:', data.summary.overview.substring(0, 300) + '...');
      }
      console.log('');
      console.log('Risks:', data.summary?.risks?.slice(0, 3).join(', ') || 'None');
      console.log('Opportunities:', data.summary?.opportunities?.slice(0, 3).join(', ') || 'None');
    }
  } catch (e) {
    console.log(`\n❌ Failed to call API: ${e.message}`);
    console.log('   Make sure the dev server is running on http://localhost:3000');
  }
}

test().catch(console.error);
