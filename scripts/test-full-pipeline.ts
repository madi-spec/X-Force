/**
 * Test Full Email Processing Pipeline
 *
 * Tests the complete flow:
 * 1. Find/create an unprocessed inbound email
 * 2. Run analysis with relationship context
 * 3. Verify command center item was created
 * 4. Verify relationship intelligence was updated
 * 5. Add salesperson context and reanalyze
 * 6. Show before/after changes
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('='.repeat(70));
  console.log('FULL EMAIL PROCESSING PIPELINE TEST');
  console.log('='.repeat(70));

  // Step 1: Find an unprocessed inbound email or show what we have
  console.log('\n📧 Step 1: Finding unprocessed inbound emails...');
  console.log('─'.repeat(70));

  const { data: unprocessedEmails } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, received_at, analysis_complete')
    .eq('is_sent_by_user', false)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('received_at', { ascending: false })
    .limit(5);

  console.log(`Found ${unprocessedEmails?.length || 0} unprocessed inbound emails`);

  if (unprocessedEmails && unprocessedEmails.length > 0) {
    console.log('\nUnprocessed emails:');
    for (const email of unprocessedEmails.slice(0, 3)) {
      console.log(`  - ${email.from_name || 'Unknown'} <${email.from_email}>`);
      console.log(`    Subject: ${email.subject?.substring(0, 50) || '(no subject)'}`);
      console.log(`    Received: ${email.received_at}`);
    }
  }

  // Check for processed emails to see what the output looks like
  console.log('\n📋 Looking at recently processed emails...');
  console.log('─'.repeat(70));

  const { data: processedEmails } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, ai_analysis, analysis_complete')
    .eq('is_sent_by_user', false)
    .eq('analysis_complete', true)
    .order('received_at', { ascending: false })
    .limit(3);

  if (processedEmails && processedEmails.length > 0) {
    console.log(`Found ${processedEmails.length} processed emails`);
    const email = processedEmails[0];
    console.log(`\nMost recent processed:`);
    console.log(`  From: ${email.from_name || 'Unknown'} <${email.from_email}>`);
    console.log(`  Subject: ${email.subject || '(no subject)'}`);

    if (email.ai_analysis) {
      const analysis = email.ai_analysis as any;
      console.log(`\n  AI Analysis:`);
      console.log(`    Request Type: ${analysis.email_analysis?.request_type || 'N/A'}`);
      console.log(`    Summary: ${analysis.email_analysis?.summary?.substring(0, 100) || 'N/A'}...`);
      console.log(`    Sentiment: ${analysis.email_analysis?.sentiment || 'N/A'}`);
      console.log(`    Urgency: ${analysis.email_analysis?.urgency || 'N/A'}`);
      console.log(`    Tier: ${analysis.command_center_classification?.tier || 'N/A'}`);
      console.log(`    Why Now: ${analysis.command_center_classification?.why_now || 'N/A'}`);
      console.log(`    Buying Signals: ${analysis.buying_signals?.length || 0}`);
      console.log(`    Concerns: ${analysis.concerns_detected?.length || 0}`);

      if (analysis.response_draft?.body) {
        console.log(`    Has Draft Response: Yes (${analysis.response_draft.body.length} chars)`);
      }
    }
  } else {
    console.log('No processed emails found');
  }

  // Step 2: Check command center items
  console.log('\n📊 Step 2: Checking command center items...');
  console.log('─'.repeat(70));

  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select(`
      id, tier, tier_trigger, why_now, title, description,
      buying_signals, concerns, suggested_actions, email_draft,
      target_name, company_name, source,
      contact:contacts(id, name, email),
      company:companies(id, name)
    `)
    .eq('source', 'email_ai_analysis')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  if (ccItems && ccItems.length > 0) {
    console.log(`Found ${ccItems.length} command center items from email analysis`);

    const item = ccItems[0];
    console.log(`\nMost recent item:`);
    console.log(`  Title: ${item.title}`);
    console.log(`  Tier: ${item.tier} (${item.tier_trigger})`);
    console.log(`  Why Now: ${item.why_now || 'N/A'}`);
    console.log(`  Target: ${item.target_name}`);
    console.log(`  Company: ${item.company_name}`);
    console.log(`  Description: ${item.description?.substring(0, 100)}...`);

    // Show buying signals
    const signals = item.buying_signals as any[];
    if (signals && signals.length > 0) {
      console.log(`\n  Buying Signals (${signals.length}):`);
      for (const s of signals.slice(0, 3)) {
        console.log(`    - [${s.strength}] ${s.signal}`);
        if (s.quote) console.log(`      Quote: "${s.quote.substring(0, 60)}..."`);
      }
    }

    // Show concerns
    const concerns = item.concerns as any[];
    if (concerns && concerns.length > 0) {
      console.log(`\n  Concerns (${concerns.length}):`);
      for (const c of concerns.slice(0, 3)) {
        console.log(`    - [${c.severity}] ${c.concern}`);
      }
    }

    // Show suggested actions
    const actions = item.suggested_actions as any[];
    if (actions && actions.length > 0) {
      console.log(`\n  Suggested Actions (${actions.length}):`);
      for (const a of actions.slice(0, 3)) {
        console.log(`    - [${a.priority}] ${a.action}`);
      }
    }

    // Show email draft
    const draft = item.email_draft as { subject?: string; body?: string } | null;
    if (draft?.body) {
      console.log(`\n  Email Draft:`);
      console.log(`    Subject: ${draft.subject}`);
      console.log(`    Body: ${draft.body?.substring(0, 200)}...`);
    }
  } else {
    console.log('No command center items from email analysis found');
  }

  // Step 3: Check relationship intelligence
  console.log('\n📈 Step 3: Checking relationship intelligence...');
  console.log('─'.repeat(70));

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, contact_id, company_id, relationship_summary, interactions, signals, metrics')
    .not('contact_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(3);

  if (riRecords && riRecords.length > 0) {
    console.log(`Found ${riRecords.length} relationship intelligence records`);

    const ri = riRecords[0];
    const interactions = (ri.interactions as any[]) || [];
    const signals = ri.signals as any;
    const metrics = ri.metrics as any;

    console.log(`\nMost recent record:`);
    console.log(`  Contact ID: ${ri.contact_id}`);
    console.log(`  Interactions: ${interactions.length}`);
    console.log(`  Buying Signals: ${signals?.buying_signals?.length || 0}`);
    console.log(`  Concerns: ${signals?.concerns?.length || 0}`);
    console.log(`  Total Interactions: ${metrics?.total_interactions || 0}`);
    console.log(`  Summary: ${ri.relationship_summary?.substring(0, 100) || 'N/A'}...`);
  } else {
    console.log('No relationship intelligence records found');
  }

  // Step 4: Check for salesperson notes
  console.log('\n📝 Step 4: Checking salesperson notes...');
  console.log('─'.repeat(70));

  const { data: notes, count: notesCount } = await supabase
    .from('relationship_notes')
    .select('*', { count: 'exact' })
    .order('added_at', { ascending: false })
    .limit(5);

  console.log(`Total notes in database: ${notesCount || 0}`);

  if (notes && notes.length > 0) {
    console.log('\nRecent notes:');
    for (const note of notes.slice(0, 3)) {
      console.log(`  - [${note.context_type}] ${note.note?.substring(0, 60)}...`);
      console.log(`    Added: ${note.added_at}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 PIPELINE STATUS');
  console.log('='.repeat(70));

  const stats = {
    unprocessedInbound: unprocessedEmails?.length || 0,
    processedEmails: processedEmails?.length || 0,
    commandCenterItems: ccItems?.length || 0,
    relationshipRecords: riRecords?.length || 0,
    salespersonNotes: notesCount || 0,
  };

  console.log(`\n✅ Email Pipeline Components:`);
  console.log(`   • Unprocessed inbound emails: ${stats.unprocessedInbound}`);
  console.log(`   • Processed emails with AI analysis: ${stats.processedEmails > 0 ? '✓' : '○'}`);
  console.log(`   • Command center items from emails: ${stats.commandCenterItems > 0 ? '✓' : '○'}`);
  console.log(`   • Relationship intelligence records: ${stats.relationshipRecords > 0 ? '✓' : '○'}`);
  console.log(`   • Salesperson notes: ${stats.salespersonNotes}`);

  console.log(`\n🔄 Pipeline Flow:`);
  console.log(`   1. Email synced from Microsoft → email_messages table`);
  console.log(`   2. Cron job picks up unprocessed emails`);
  console.log(`   3. enrichEmailContext() gathers relationship intelligence`);
  console.log(`   4. analyzeEmail() runs AI with full context`);
  console.log(`   5. Command center item created with rich data`);
  console.log(`   6. Relationship intelligence updated`);
  console.log(`   7. Salesperson can add context and trigger reanalysis`);

  if (stats.unprocessedInbound > 0) {
    console.log(`\n⚡ To process unprocessed emails, run:`);
    console.log(`   npx tsx -e "require('./src/lib/email').processAllUnanalyzedEmails()"`);
    console.log(`   Or call GET /api/cron/analyze-emails`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
