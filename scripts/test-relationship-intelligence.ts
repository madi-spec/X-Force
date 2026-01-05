/**
 * End-to-End Relationship Intelligence System Test
 *
 * Tests:
 * 1. Email Analysis Pipeline
 * 2. Outbound Email Tracking
 * 3. Context Addition + Re-analysis
 * 4. Cumulative Intelligence
 * 5. Cron Job Verification
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DIVIDER = '='.repeat(70);
const SECTION = '-'.repeat(70);

async function test1_EmailAnalysisPipeline() {
  console.log('\n' + DIVIDER);
  console.log('TEST 1: EMAIL ANALYSIS PIPELINE');
  console.log(DIVIDER);

  // 1. Find an unanalyzed inbound email
  console.log('\n📧 Finding unanalyzed inbound email...');
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, user_id, from_email, from_name, subject, received_at, conversation_ref')
    .eq('is_sent_by_user', false)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('received_at', { ascending: false })
    .limit(1);

  if (!emails || emails.length === 0) {
    console.log('❌ No unanalyzed inbound emails found');
    return null;
  }

  const email = emails[0];
  console.log(`✓ Found email: ${email.from_name} <${email.from_email}>`);
  console.log(`  Subject: ${email.subject?.substring(0, 60)}`);
  console.log(`  Email ID: ${email.id}`);

  // 2. Run analysis
  console.log('\n🔄 Running processInboundEmail...');

  // Import and run the analysis
  const { processInboundEmail } = await import('../src/lib/email/processInboundEmail');

  const result = await processInboundEmail(email.id);

  console.log(`\n📊 Analysis Result:`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Already Replied: ${result.alreadyReplied}`);
  console.log(`  Command Center Item ID: ${result.commandCenterItemId || 'N/A'}`);

  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }

  if (result.analysis) {
    const a = result.analysis;
    console.log('\n📋 Analysis Details:');
    console.log(`  Request Type: ${a.email_analysis?.request_type || 'N/A'}`);
    console.log(`  Sentiment: ${a.email_analysis?.sentiment || 'N/A'}`);
    console.log(`  Urgency: ${a.email_analysis?.urgency || 'N/A'}`);
    console.log(`  Summary: ${a.email_analysis?.summary?.substring(0, 100) || 'N/A'}...`);

    console.log('\n🎯 Command Center Classification:');
    console.log(`  Tier: ${a.command_center_classification?.tier || 'N/A'}`);
    console.log(`  Tier Trigger: ${a.command_center_classification?.tier_trigger || 'N/A'}`);
    console.log(`  Why Now: ${a.command_center_classification?.why_now || 'N/A'}`);
    console.log(`  SLA Minutes: ${a.command_center_classification?.sla_minutes || 'N/A'}`);

    console.log('\n📈 Buying Signals:');
    if (a.buying_signals && a.buying_signals.length > 0) {
      for (const s of a.buying_signals.slice(0, 3)) {
        console.log(`  • [${s.strength}] ${s.signal}`);
        if (s.quote) console.log(`    Quote: "${s.quote.substring(0, 60)}..."`);
      }
    } else {
      console.log('  (none detected)');
    }

    console.log('\n⚠️ Concerns Detected:');
    if (a.concerns_detected && a.concerns_detected.length > 0) {
      for (const c of a.concerns_detected.slice(0, 3)) {
        console.log(`  • [${c.severity}] ${c.concern}`);
      }
    } else {
      console.log('  (none detected)');
    }

    console.log('\n✉️ Response Draft:');
    if (a.response_draft?.body) {
      console.log(`  Subject: ${a.response_draft.subject || 'N/A'}`);
      console.log(`  Body Preview: ${a.response_draft.body.substring(0, 150)}...`);
      console.log(`  Confidence: ${a.response_draft.confidence || 'N/A'}%`);
    } else {
      console.log('  (no draft generated)');
    }
  }

  // 3. Check if relationship intelligence was updated
  console.log('\n🔍 Checking Relationship Intelligence Update...');

  // Get the conversation to find contact/company
  const { data: conv } = await supabase
    .from('email_conversations')
    .select('contact_id, company_id')
    .eq('id', email.conversation_ref)
    .single();

  if (conv?.contact_id || conv?.company_id) {
    let riQuery = supabase
      .from('relationship_intelligence')
      .select('id, interactions, signals, updated_at');

    if (conv.contact_id) {
      riQuery = riQuery.eq('contact_id', conv.contact_id);
    } else {
      riQuery = riQuery.eq('company_id', conv.company_id);
    }

    const { data: ri } = await riQuery.single();

    if (ri) {
      const interactions = (ri.interactions as any[]) || [];
      const signals = ri.signals as any;
      console.log(`  ✓ Relationship Intelligence Record Found`);
      console.log(`    Total Interactions: ${interactions.length}`);
      console.log(`    Buying Signals: ${signals?.buying_signals?.length || 0}`);
      console.log(`    Concerns: ${signals?.concerns?.length || 0}`);
      console.log(`    Last Updated: ${ri.updated_at}`);
    } else {
      console.log('  ⚠️ No relationship intelligence record found');
    }
  }

  return result.commandCenterItemId;
}

async function test2_OutboundEmailTracking() {
  console.log('\n' + DIVIDER);
  console.log('TEST 2: OUTBOUND EMAIL TRACKING');
  console.log(DIVIDER);

  // 1. Find an unanalyzed outbound email
  console.log('\n📤 Finding unanalyzed outbound email...');
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, to_email, subject, sent_at, conversation_ref')
    .eq('is_sent_by_user', true)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('sent_at', { ascending: false })
    .limit(1);

  if (!emails || emails.length === 0) {
    console.log('❌ No unanalyzed outbound emails found');
    return;
  }

  const email = emails[0];
  console.log(`✓ Found sent email to: ${email.to_email}`);
  console.log(`  Subject: ${email.subject?.substring(0, 60)}`);
  console.log(`  Email ID: ${email.id}`);

  // 2. Run outbound analysis
  console.log('\n🔄 Running processOutboundEmail...');

  try {
    const { processOutboundEmail } = await import('../src/lib/intelligence/analyzeOutboundEmail');
    const result = await processOutboundEmail(email.id);

    console.log(`\n📊 Outbound Analysis Result:`);
    console.log(`  Success: ${result.success}`);

    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }

    if (result.analysis) {
      console.log('\n📝 Commitments Made:');
      if (result.analysis.commitments_made && result.analysis.commitments_made.length > 0) {
        for (const c of result.analysis.commitments_made) {
          console.log(`  • ${c.commitment}`);
          if (c.due_by) console.log(`    Due by: ${c.due_by}`);
        }
      } else {
        console.log('  (no commitments detected)');
      }

      console.log('\n📅 Follow-up Expectations:');
      if (result.analysis.follow_up_expected) {
        console.log(`  Expected: ${result.analysis.follow_up_expected.expected ? 'Yes' : 'No'}`);
        if (result.analysis.follow_up_expected.by_date) {
          console.log(`  By Date: ${result.analysis.follow_up_expected.by_date}`);
        }
      }
    }

    // Check if commitments were added to relationship intelligence
    const { data: conv } = await supabase
      .from('email_conversations')
      .select('contact_id, company_id')
      .eq('id', email.conversation_ref)
      .single();

    if (conv?.contact_id || conv?.company_id) {
      let riQuery = supabase
        .from('relationship_intelligence')
        .select('open_commitments');

      if (conv.contact_id) {
        riQuery = riQuery.eq('contact_id', conv.contact_id);
      } else {
        riQuery = riQuery.eq('company_id', conv.company_id);
      }

      const { data: ri } = await riQuery.single();

      if (ri) {
        const commitments = ri.open_commitments as any;
        console.log('\n🎯 Open Commitments in Relationship Intelligence:');
        console.log(`  Our commitments: ${commitments?.ours?.length || 0}`);
        console.log(`  Their commitments: ${commitments?.theirs?.length || 0}`);

        if (commitments?.ours?.length > 0) {
          console.log('\n  Recent "ours" commitments:');
          for (const c of commitments.ours.slice(-3)) {
            console.log(`    • ${c.commitment} (${c.status})`);
          }
        }
      }
    }
  } catch (err) {
    console.log(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function test3_ContextAdditionReanalysis(itemId: string | null) {
  console.log('\n' + DIVIDER);
  console.log('TEST 3: CONTEXT ADDITION + RE-ANALYSIS');
  console.log(DIVIDER);

  // Use provided itemId or find one
  let testItemId = itemId;

  if (!testItemId) {
    console.log('\n🔍 Finding a command center item to test...');
    const { data: items } = await supabase
      .from('command_center_items')
      .select('id, tier, why_now, email_draft, source')
      .eq('source', 'email_ai_analysis')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!items || items.length === 0) {
      console.log('❌ No command center items found for testing');
      return;
    }
    testItemId = items[0].id;
  }

  console.log(`\n📋 Testing with item: ${testItemId}`);

  // Get BEFORE state
  const { data: beforeItem } = await supabase
    .from('command_center_items')
    .select('tier, tier_trigger, why_now, email_draft, suggested_actions, buying_signals')
    .eq('id', testItemId)
    .single();

  if (!beforeItem) {
    console.log('❌ Could not find item');
    return;
  }

  console.log('\n📊 BEFORE State:');
  console.log(`  Tier: ${beforeItem.tier}`);
  console.log(`  Tier Trigger: ${beforeItem.tier_trigger}`);
  console.log(`  Why Now: ${beforeItem.why_now || 'N/A'}`);
  const beforeDraft = beforeItem.email_draft as any;
  console.log(`  Draft Subject: ${beforeDraft?.subject || 'N/A'}`);
  console.log(`  Draft Preview: ${beforeDraft?.body?.substring(0, 100) || 'N/A'}...`);

  // Check if reanalyze endpoint exists
  console.log('\n🔄 Checking for reanalyze endpoint...');

  // Check if the endpoint file exists
  const fs = await import('fs');
  const reanalyzePath = './src/app/api/command-center/[itemId]/reanalyze/route.ts';

  if (fs.existsSync(reanalyzePath)) {
    console.log('  ✓ Reanalyze endpoint exists');

    // We'd need to make an HTTP call to test this properly
    // For now, just note that manual testing would be needed
    console.log('\n⚠️ Manual testing required:');
    console.log('  POST /api/command-center/${itemId}/reanalyze');
    console.log('  Body: { "context": "They are evaluating Gong, board meeting next Tuesday" }');
  } else {
    console.log('  ⚠️ Reanalyze endpoint not found at expected path');
    console.log('  Creating this endpoint would be needed for full reanalysis support');
  }
}

async function test4_CumulativeIntelligence() {
  console.log('\n' + DIVIDER);
  console.log('TEST 4: CUMULATIVE INTELLIGENCE');
  console.log(DIVIDER);

  // Find a contact with the most interactions
  console.log('\n🔍 Finding contact with richest relationship history...');

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select(`
      id, contact_id, company_id, relationship_summary,
      interactions, open_commitments, signals, metrics,
      context, updated_at
    `)
    .not('contact_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (!riRecords || riRecords.length === 0) {
    console.log('❌ No relationship intelligence records found');
    return;
  }

  // Find the one with most interactions
  let richestRecord = riRecords[0];
  let maxInteractions = 0;

  for (const ri of riRecords) {
    const interactions = (ri.interactions as any[]) || [];
    if (interactions.length > maxInteractions) {
      maxInteractions = interactions.length;
      richestRecord = ri;
    }
  }

  // Get contact details
  const { data: contact } = await supabase
    .from('contacts')
    .select('name, email, title, company:companies(name)')
    .eq('id', richestRecord.contact_id)
    .single();

  const contactInfo = contact as any;
  console.log(`\n👤 Contact: ${contactInfo?.name || 'Unknown'}`);
  console.log(`   Email: ${contactInfo?.email || 'N/A'}`);
  console.log(`   Title: ${contactInfo?.title || 'N/A'}`);
  console.log(`   Company: ${contactInfo?.company?.name || 'N/A'}`);

  const interactions = (richestRecord.interactions as any[]) || [];
  const signals = richestRecord.signals as any;
  const commitments = richestRecord.open_commitments as any;
  const metrics = richestRecord.metrics as any;
  const context = richestRecord.context as any;

  console.log('\n📊 Relationship Metrics:');
  console.log(`  Total Interactions: ${interactions.length}`);
  console.log(`  Days in Relationship: ${metrics?.days_in_relationship || 'N/A'}`);
  console.log(`  Last Contact: ${metrics?.last_contact_date || 'N/A'}`);
  console.log(`  Sentiment Trend: ${metrics?.overall_sentiment_trend || 'N/A'}`);
  console.log(`  Engagement Score: ${metrics?.engagement_score || 'N/A'}`);

  console.log('\n📈 Buying Signals Accumulated:');
  if (signals?.buying_signals?.length > 0) {
    for (const s of signals.buying_signals.slice(-5)) {
      console.log(`  • [${s.strength}] ${s.signal}`);
      console.log(`    Date: ${s.date}`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\n⚠️ Concerns Tracked:');
  if (signals?.concerns?.length > 0) {
    for (const c of signals.concerns.slice(-5)) {
      console.log(`  • [${c.severity}] ${c.concern}`);
      console.log(`    Resolved: ${c.resolved ? 'Yes' : 'No'}`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\n🎯 Open Commitments:');
  console.log(`  Ours: ${commitments?.ours?.filter((c: any) => c.status === 'pending').length || 0} pending`);
  console.log(`  Theirs: ${commitments?.theirs?.filter((c: any) => c.status === 'pending').length || 0} pending`);

  if (commitments?.ours?.length > 0) {
    console.log('\n  Our Commitments:');
    for (const c of commitments.ours.slice(-3)) {
      console.log(`    • ${c.commitment} [${c.status}]`);
    }
  }

  console.log('\n📝 Relationship Summary:');
  console.log(`  ${richestRecord.relationship_summary || '(not yet generated)'}`);

  console.log('\n📋 Key Facts:');
  if (context?.key_facts?.length > 0) {
    for (const f of context.key_facts.slice(-5)) {
      console.log(`  • ${f.fact} (from ${f.source})`);
    }
  } else {
    console.log('  (none recorded)');
  }

  console.log('\n🕐 Interaction Timeline (last 5):');
  for (const int of interactions.slice(-5)) {
    console.log(`  ${int.date} [${int.type}]`);
    console.log(`    ${int.summary?.substring(0, 80) || 'No summary'}...`);
  }
}

async function test5_CronJobVerification() {
  console.log('\n' + DIVIDER);
  console.log('TEST 5: CRON JOB VERIFICATION');
  console.log(DIVIDER);

  // Check vercel.json for cron config
  console.log('\n📋 Checking vercel.json for cron configuration...');

  const fs = await import('fs');
  const vercelConfigPath = './vercel.json';

  if (fs.existsSync(vercelConfigPath)) {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));

    if (vercelConfig.crons) {
      console.log('  ✓ Cron jobs found:');
      for (const cron of vercelConfig.crons) {
        console.log(`    • ${cron.path}`);
        console.log(`      Schedule: ${cron.schedule}`);
      }

      const analyzeEmailsCron = vercelConfig.crons.find((c: any) =>
        c.path.includes('analyze-emails')
      );

      if (analyzeEmailsCron) {
        console.log('\n  ✓ Email analysis cron is configured');
      } else {
        console.log('\n  ⚠️ analyze-emails cron not found - needs to be added');
      }
    } else {
      console.log('  ⚠️ No crons configured in vercel.json');
    }
  } else {
    console.log('  ⚠️ vercel.json not found');
  }

  // Run the cron manually
  console.log('\n🔄 Manually triggering email analysis cron...');

  try {
    const { processAllUnanalyzedEmails } = await import('../src/lib/email/processInboundEmail');
    const result = await processAllUnanalyzedEmails(undefined, 5, 3);

    console.log('\n📊 Cron Results:');
    console.log('\n  Inbound Emails:');
    console.log(`    Processed: ${result.inbound.processed}`);
    console.log(`    Items Created: ${result.inbound.itemsCreated}`);
    console.log(`    Skipped (Already Replied): ${result.inbound.skippedAlreadyReplied}`);
    console.log(`    Skipped (Already Analyzed): ${result.inbound.skippedAlreadyAnalyzed}`);
    if (result.inbound.errors.length > 0) {
      console.log(`    Errors: ${result.inbound.errors.slice(0, 3).join(', ')}`);
    }

    console.log('\n  Outbound Emails:');
    console.log(`    Processed: ${result.outbound.processed}`);
    console.log(`    Commitments Tracked: ${result.outbound.commitmentsMade}`);
    if (result.outbound.errors.length > 0) {
      console.log(`    Errors: ${result.outbound.errors.slice(0, 3).join(', ')}`);
    }
  } catch (err) {
    console.log(`❌ Error running cron: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}

async function main() {
  console.log(DIVIDER);
  console.log('RELATIONSHIP INTELLIGENCE SYSTEM - END-TO-END TEST');
  console.log(DIVIDER);
  console.log(`Started: ${new Date().toISOString()}`);

  try {
    // Run all tests
    const ccItemId = await test1_EmailAnalysisPipeline();
    await test2_OutboundEmailTracking();
    await test3_ContextAdditionReanalysis(ccItemId);
    await test4_CumulativeIntelligence();
    await test5_CronJobVerification();

    // Summary
    console.log('\n' + DIVIDER);
    console.log('TEST SUMMARY');
    console.log(DIVIDER);

    console.log('\n✅ Tests Completed');
    console.log('\nKey Observations:');
    console.log('  1. Email Analysis Pipeline - Check output above for success');
    console.log('  2. Outbound Tracking - Check if commitments were extracted');
    console.log('  3. Context Addition - Manual testing may be needed for reanalysis');
    console.log('  4. Cumulative Intelligence - Check interaction/signal counts');
    console.log('  5. Cron Job - Verify configuration and execution');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }

  console.log('\n' + DIVIDER);
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log(DIVIDER);
}

main().catch(console.error);
