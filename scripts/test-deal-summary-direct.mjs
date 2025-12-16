/**
 * Test the deal summary generator directly (bypassing API auth)
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

// Now dynamically import the summary generator (needs env vars loaded first)
async function test() {
  console.log('=== Testing Deal Summary with Database Prompts ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if the prompt exists in the database
  const { data: prompt, error: promptError } = await supabase
    .from('ai_prompts')
    .select('id, key, name, version, prompt_template')
    .eq('key', 'deal_summary')
    .single();

  if (promptError || !prompt) {
    console.log('❌ Deal summary prompt NOT found in database');
    console.log('   The summary will use the fallback inline prompt');
  } else {
    console.log('✓ Deal summary prompt found in database');
    console.log(`  Name: ${prompt.name}`);
    console.log(`  Version: ${prompt.version}`);
    console.log(`  Template length: ${prompt.prompt_template.length} chars`);
    console.log(`  Has template vars: ${prompt.prompt_template.includes('{{dealInfo}}') ? 'Yes' : 'No'}`);
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

  // Import and call the generator directly
  console.log('Importing deal summary generator...');

  try {
    const { generateDealSummary } = await import('../src/lib/ai/summaries/dealSummary.ts');

    console.log('Generating summary (force=true)...\n');
    const startTime = Date.now();

    const result = await generateDealSummary(deal.id, { force: true });

    console.log(`✓ Summary generated successfully!`);
    console.log(`  Tokens used: ${result.tokensUsed}`);
    console.log(`  Latency: ${result.latencyMs}ms`);
    console.log(`  Is new: ${result.isNew}`);
    console.log(`  Was stale: ${result.wasStale}`);
    console.log('');
    console.log('--- Summary ---');
    console.log(`Headline: ${result.summary?.headline}`);
    console.log('');
    if (result.summary?.overview) {
      console.log('Overview:', result.summary.overview.substring(0, 500) + '...');
    }
    console.log('');
    console.log('Current Status:', JSON.stringify(result.summary?.currentStatus, null, 2));
    console.log('');
    console.log('Risks:', result.summary?.risks?.join('\n  - ') || 'None');
    console.log('');
    console.log('Opportunities:', result.summary?.opportunities?.join('\n  - ') || 'None');
    console.log('');
    console.log('Recommended Actions:');
    result.summary?.recommendedActions?.forEach((a, i) => {
      console.log(`  ${i + 1}. [${a.priority}] ${a.action}`);
    });
  } catch (e) {
    console.log(`\n❌ Error: ${e.message}`);
    console.log(e.stack);
  }
}

test().catch(console.error);
