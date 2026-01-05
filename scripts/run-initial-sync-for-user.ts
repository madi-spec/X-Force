/**
 * Run Initial Historical Sync for a Specific User
 *
 * Usage: npx tsx scripts/run-initial-sync-for-user.ts <email>
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const targetEmail = process.argv[2] || 'xraisales@affiliatedtech.com';

async function main() {
  console.log('='.repeat(70));
  console.log('INITIAL HISTORICAL SYNC');
  console.log('='.repeat(70));
  console.log(`\nTarget user: ${targetEmail}\n`);

  // Step 1: Find the user
  console.log('--- Step 1: Finding User ---\n');

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', targetEmail)
    .single();

  if (userError || !user) {
    console.error('User not found:', userError?.message || 'No user with that email');
    return;
  }

  console.log('Found user:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);

  // Step 2: Check Microsoft integration
  console.log('\n--- Step 2: Checking Microsoft Integration ---\n');

  // Query using raw SQL through RPC to avoid schema cache issues
  const { data: msIntegrations, error: msError } = await supabase
    .rpc('get_microsoft_integration', { p_user_id: user.id });

  // Fallback to direct query
  let msIntegration = msIntegrations?.[0];
  if (!msIntegration) {
    const result = await supabase
      .from('microsoft_integrations')
      .select('id, access_token, refresh_token, token_expires_at, created_at')
      .eq('user_id', user.id)
      .maybeSingle();
    msIntegration = result.data;
    if (result.error) {
      console.log('Query error:', result.error.message);
    }
  }

  if (!msIntegration) {
    console.log('No Microsoft integration found.');
    console.log('\nProceeding with existing data sync (transcripts + existing emails)...');
    // Don't return - we can still process transcripts and existing data
  } else {
    const tokenExpiry = new Date(msIntegration.token_expires_at);
    const isExpired = tokenExpiry < new Date();

    console.log('Microsoft integration found:');
    console.log('  Integration ID:', msIntegration.id);
    console.log('  Has access token:', !!msIntegration.access_token);
    console.log('  Has refresh token:', !!msIntegration.refresh_token);
    console.log('  Token expires at:', msIntegration.token_expires_at);
    console.log('  Token expired:', isExpired);
    console.log('  Connected since:', msIntegration.created_at);

    if (isExpired && !msIntegration.refresh_token) {
      console.log('\nWarning: Token expired. Will attempt refresh during sync.');
    }
  }

  // Step 3: Clear any previous sync progress (if table exists)
  console.log('\n--- Step 3: Preparing for Sync ---\n');

  // Try to clear sync_progress if it exists
  const { error: clearError } = await supabase
    .from('sync_progress')
    .delete()
    .eq('user_id', user.id);

  if (clearError && !clearError.message.includes('does not exist')) {
    console.log('Warning clearing sync progress:', clearError.message);
  }
  console.log('Ready to sync.');

  // Step 4: Run the sync
  console.log('\n--- Step 4: Running Initial Historical Sync ---\n');

  const { runInitialHistoricalSync } = await import('../src/lib/sync/initialHistoricalSync');

  let lastPhase = '';
  let phaseStartTime = Date.now();

  const result = await runInitialHistoricalSync(user.id, (message, phase, current, total) => {
    // Track phase changes
    if (phase && phase !== lastPhase) {
      if (lastPhase) {
        const elapsed = ((Date.now() - phaseStartTime) / 1000).toFixed(1);
        console.log(`  └── Phase completed in ${elapsed}s\n`);
      }
      console.log(`\n[${phase.toUpperCase()}]`);
      lastPhase = phase;
      phaseStartTime = Date.now();
    }

    // Show progress
    if (current !== undefined && total !== undefined && total > 0) {
      const percent = Math.round((current / total) * 100);
      // Only log every 10% or for important messages
      if (percent % 10 === 0 || current === total || message.includes('error') || message.includes('Error')) {
        console.log(`  [${percent}%] ${message}`);
      }
    } else {
      console.log(`  ${message}`);
    }
  });

  // Final phase timing
  if (lastPhase) {
    const elapsed = ((Date.now() - phaseStartTime) / 1000).toFixed(1);
    console.log(`  └── Phase completed in ${elapsed}s`);
  }

  // Step 5: Show results
  console.log('\n' + '='.repeat(70));
  console.log('SYNC RESULTS');
  console.log('='.repeat(70));

  console.log('\nOverall:');
  console.log('  Success:', result.success);
  if (result.error) {
    console.log('  Error:', result.error);
  }
  console.log('  Started:', result.startedAt);
  console.log('  Completed:', result.completedAt);

  console.log('\n--- Emails ---');
  console.log('  Imported:', result.phases.emails.imported);
  console.log('  Skipped:', result.phases.emails.skipped);
  console.log('  Errors:', result.phases.emails.errors.length);
  if (result.phases.emails.errors.length > 0) {
    console.log('  Error details:');
    result.phases.emails.errors.slice(0, 3).forEach((err, i) => {
      console.log(`    ${i + 1}. ${err}`);
    });
  }

  console.log('\n--- Calendar ---');
  console.log('  Imported:', result.phases.calendar.imported);
  console.log('  Skipped:', result.phases.calendar.skipped);
  console.log('  Errors:', result.phases.calendar.errors.length);

  console.log('\n--- Transcripts ---');
  console.log('  Count:', result.phases.transcripts.count);

  console.log('\n--- Processing ---');
  console.log('  Total items:', result.phases.processing.total);
  console.log('  Processed:', result.phases.processing.processed);
  console.log('  RI Updates:', result.phases.processing.riUpdates);
  console.log('  Errors:', result.phases.processing.errors.length);

  console.log('\n--- Command Center ---');
  console.log('  Items Created:', result.phases.commandCenter.itemsCreated);
  console.log('  Tier 1 (Respond Now):', result.phases.commandCenter.tier1);
  console.log('  Tier 2 (Hot Leads):', result.phases.commandCenter.tier2);
  console.log('  Tier 3 (Commitments):', result.phases.commandCenter.tier3);
  console.log('  Tier 4 (Follow-ups):', result.phases.commandCenter.tier4);

  // Step 6: Verify and show examples
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE COMMAND CENTER ITEMS');
  console.log('='.repeat(70));

  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select(`
      id, title, tier, tier_trigger, why_now, source, status, created_at,
      contact:contacts(id, name, email),
      company:companies(id, name)
    `)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('tier', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(5);

  if (ccItems && ccItems.length > 0) {
    ccItems.forEach((item, index) => {
      console.log(`\n${index + 1}. [Tier ${item.tier}] ${item.tier_trigger}`);
      console.log(`   Title: ${item.title?.substring(0, 70)}${(item.title?.length || 0) > 70 ? '...' : ''}`);
      console.log(`   Why Now: ${item.why_now?.substring(0, 70) || 'N/A'}${(item.why_now?.length || 0) > 70 ? '...' : ''}`);
      console.log(`   Contact: ${(item.contact as any)?.name || 'N/A'} (${(item.contact as any)?.email || 'N/A'})`);
      console.log(`   Company: ${(item.company as any)?.name || 'N/A'}`);
      console.log(`   Source: ${item.source}`);
    });
  } else {
    console.log('\nNo pending command center items found.');
  }

  // Step 7: Show RI stats
  console.log('\n' + '='.repeat(70));
  console.log('RELATIONSHIP INTELLIGENCE STATS');
  console.log('='.repeat(70));

  const { count: riTotal } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: riWithInteractions } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('interactions', 'is', null);

  const { data: riSample } = await supabase
    .from('relationship_intelligence')
    .select(`
      contact:contacts(name, email),
      company:companies(name),
      relationship_strength,
      interactions,
      buying_signals,
      concerns,
      our_commitments
    `)
    .eq('user_id', user.id)
    .not('interactions', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(3);

  console.log(`\nTotal RI records: ${riTotal}`);
  console.log(`RI records with interactions: ${riWithInteractions}`);

  if (riSample && riSample.length > 0) {
    console.log('\nSample RI Records:');
    riSample.forEach((ri, index) => {
      const contact = ri.contact as any;
      const company = ri.company as any;
      console.log(`\n${index + 1}. ${contact?.name || 'Unknown'} at ${company?.name || 'Unknown'}`);
      console.log(`   Email: ${contact?.email || 'N/A'}`);
      console.log(`   Relationship Strength: ${ri.relationship_strength || 'N/A'}`);
      console.log(`   Total Interactions: ${ri.interactions?.length || 0}`);
      console.log(`   Buying Signals: ${ri.buying_signals?.length || 0}`);
      console.log(`   Concerns: ${ri.concerns?.length || 0}`);
      console.log(`   Our Commitments: ${ri.our_commitments?.length || 0}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
