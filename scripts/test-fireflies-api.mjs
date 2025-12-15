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

async function testFirefliesAPI() {
  // Get API key
  const { data: conn } = await supabase
    .from('fireflies_connections')
    .select('api_key')
    .eq('is_active', true)
    .single();

  if (!conn) {
    console.log('No active Fireflies connection');
    return;
  }

  const apiKey = conn.api_key;
  console.log('=== Testing Fireflies API ===\n');

  // Test 1: Get user info
  console.log('1. Testing user query...');
  const userQuery = `query { user { email name } }`;
  const userRes = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ query: userQuery }),
  });
  const userData = await userRes.json();
  if (userData.errors) {
    console.log('   Error:', userData.errors[0].message);
  } else {
    console.log('   User:', userData.data?.user?.email);
  }

  // Test 2: Get all transcripts without limit
  console.log('\n2. Testing transcripts (no limit)...');
  const noLimitQuery = `query { transcripts { id title date } }`;
  const noLimitRes = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ query: noLimitQuery }),
  });
  const noLimitData = await noLimitRes.json();
  if (noLimitData.errors) {
    console.log('   Error:', noLimitData.errors[0].message);
  } else {
    console.log('   Found:', noLimitData.data?.transcripts?.length, 'transcripts');
  }

  // Test 3: Get transcripts with higher limit
  console.log('\n3. Testing transcripts (limit: 100)...');
  const limitQuery = `query { transcripts(limit: 100) { id title date } }`;
  const limitRes = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ query: limitQuery }),
  });
  const limitData = await limitRes.json();
  if (limitData.errors) {
    console.log('   Error:', limitData.errors[0].message);
  } else {
    const transcripts = limitData.data?.transcripts || [];
    console.log('   Found:', transcripts.length, 'transcripts');
    if (transcripts.length > 0) {
      console.log('\n   All transcripts:');
      transcripts.forEach((t, i) => {
        const date = new Date(parseInt(t.date)).toLocaleDateString();
        console.log(`   ${i + 1}. ${t.title} (${date})`);
      });
    }
  }

  // Test 4: Try pagination with skip
  console.log('\n4. Testing pagination (skip: 20, limit: 50)...');
  const skipQuery = `query { transcripts(skip: 20, limit: 50) { id title } }`;
  const skipRes = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ query: skipQuery }),
  });
  const skipData = await skipRes.json();
  if (skipData.errors) {
    console.log('   Error:', skipData.errors[0].message);
  } else {
    console.log('   Found:', skipData.data?.transcripts?.length, 'more transcripts');
  }
}

testFirefliesAPI().catch(console.error);
