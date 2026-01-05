/**
 * Reprocess Historical Data for Complete RI Population
 *
 * Processes:
 * - All transcripts with analysis from last month
 * - All remaining sent emails from activities table
 *
 * Uses proper field mappings for:
 * - ourCommitments + actionItems(owner=us) → open_commitments.ours
 * - theirCommitments + actionItems(owner=them) → open_commitments.theirs
 * - buyingSignals → signals.buying_signals
 * - objections → signals.concerns
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import {
  updateRelationshipFromAnalysis,
  type InteractionAnalysis,
  type AnalysisCommitment,
  type AnalysisBuyingSignal,
  type AnalysisConcern,
} from '../src/lib/intelligence/updateRelationshipFromAnalysis';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';
const BATCH_SIZE = parseInt(process.argv[2] || '50', 10);

// ============================================
// TYPES
// ============================================

interface ProcessingStats {
  transcriptsProcessed: number;
  emailsProcessed: number;
  commitmentsOursAdded: number;
  commitmentsTheirsAdded: number;
  buyingSignalsAdded: number;
  concernsAdded: number;
  errors: string[];
}

interface SyncItem {
  type: 'transcript' | 'email';
  id: string;
  date: Date;
  data: any;
}

// ============================================
// GET CURRENT STATS
// ============================================

async function getCurrentStats(): Promise<{
  commitmentsOurs: number;
  commitmentsTheirs: number;
  buyingSignals: number;
  concerns: number;
  tier1: number;
  tier2: number;
  tier3: number;
  totalCC: number;
}> {
  // Get RI stats
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('open_commitments, signals');

  let commitmentsOurs = 0;
  let commitmentsTheirs = 0;
  let buyingSignals = 0;
  let concerns = 0;

  for (const ri of riRecords || []) {
    commitmentsOurs += (ri.open_commitments?.ours || []).length;
    commitmentsTheirs += (ri.open_commitments?.theirs || []).length;
    buyingSignals += (ri.signals?.buying_signals || []).length;
    concerns += (ri.signals?.concerns || []).length;
  }

  // Get CC stats
  const ccCounts = { tier1: 0, tier2: 0, tier3: 0, totalCC: 0 };

  for (let tier = 1; tier <= 3; tier++) {
    const { count } = await supabase
      .from('command_center_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tier', tier)
      .eq('status', 'pending');

    if (tier === 1) ccCounts.tier1 = count || 0;
    if (tier === 2) ccCounts.tier2 = count || 0;
    if (tier === 3) ccCounts.tier3 = count || 0;
    ccCounts.totalCC += count || 0;
  }

  return { commitmentsOurs, commitmentsTheirs, buyingSignals, concerns, ...ccCounts };
}

// ============================================
// TRANSCRIPT PROCESSING
// ============================================

function processTranscriptToInteractionAnalysis(transcript: any): InteractionAnalysis | null {
  const analysis = transcript.analysis;
  if (!analysis) return null;

  const contactId = transcript.contact_id;
  const companyId = transcript.company_id;

  if (!contactId && !companyId) return null;

  // Collect all commitments from multiple sources
  const ourCommitments: AnalysisCommitment[] = [];
  const theirCommitments: AnalysisCommitment[] = [];

  // Source 1: actionItems with owner field
  const actionItems = analysis.actionItems || [];
  for (const ai of actionItems) {
    if (ai.owner === 'us') {
      ourCommitments.push({
        commitment: ai.task,
        due_by: ai.dueDate || null,
      });
    } else if (ai.owner === 'them') {
      theirCommitments.push({
        commitment: ai.task,
        expected_by: ai.dueDate || null,
      });
    }
  }

  // Source 2: dedicated ourCommitments field (more detailed)
  const dedicatedOurs = analysis.ourCommitments || [];
  for (const c of dedicatedOurs) {
    // Avoid duplicates by checking if already exists
    const exists = ourCommitments.some(
      existing => existing.commitment.toLowerCase().includes(c.commitment.toLowerCase().substring(0, 30))
    );
    if (!exists) {
      ourCommitments.push({
        commitment: c.commitment,
        due_by: c.when || c.dueDate || null,
      });
    }
  }

  // Source 3: dedicated theirCommitments field
  const dedicatedTheirs = analysis.theirCommitments || [];
  for (const c of dedicatedTheirs) {
    const exists = theirCommitments.some(
      existing => existing.commitment.toLowerCase().includes(c.commitment.toLowerCase().substring(0, 30))
    );
    if (!exists) {
      theirCommitments.push({
        commitment: c.commitment,
        expected_by: c.when || c.expectedBy || null,
      });
    }
  }

  // Process buying signals
  const buyingSignals: AnalysisBuyingSignal[] = (analysis.buyingSignals || []).map((s: any) => ({
    signal: s.signal,
    quote: s.quote || undefined,
    strength: s.strength || 'moderate',
  }));

  // Process objections as concerns
  const concerns: AnalysisConcern[] = (analysis.objections || [])
    .filter((o: any) => !o.resolved) // Only unresolved ones
    .map((o: any) => ({
      concern: o.objection,
      severity: 'medium' as const,
    }));

  // Key facts from extracted info
  const keyFacts: string[] = [];
  if (analysis.extractedInfo?.painPoints) {
    keyFacts.push(...analysis.extractedInfo.painPoints);
  }
  if (analysis.extractedInfo?.currentSolution) {
    keyFacts.push(`Current solution: ${analysis.extractedInfo.currentSolution}`);
  }

  return {
    type: 'transcript',
    source_id: transcript.id,
    contact_id: contactId,
    company_id: companyId,
    date: transcript.meeting_date,
    summary: analysis.summary || transcript.title,
    sentiment: analysis.sentiment?.overall,
    key_points: analysis.keyPoints || [],
    key_facts_learned: keyFacts,
    buying_signals: buyingSignals,
    concerns: concerns,
    commitments_made: ourCommitments,
    commitments_received: theirCommitments,
  };
}

// ============================================
// EMAIL ANALYSIS
// ============================================

interface OutboundEmailAnalysis {
  summary: string;
  commitments_made: Array<{
    commitment: string;
    deadline_mentioned: string | null;
    inferred_due_date: string | null;
  }>;
  content_shared: Array<{ type: string; description: string }>;
  questions_asked: string[];
  tone: string;
  follow_up_expected: {
    expected: boolean;
    expected_by: string | null;
    what: string | null;
  };
}

async function analyzeOutboundEmail(
  subject: string,
  body: string,
  recipientEmail: string,
  context: { contactName?: string; companyName?: string }
): Promise<OutboundEmailAnalysis | null> {
  const prompt = `Analyze this outbound sales email to extract commitments, content shared, and follow-up expectations.

RECIPIENT: ${context.contactName || recipientEmail} at ${context.companyName || 'Unknown Company'}

SUBJECT: ${subject}

EMAIL BODY:
${body}

---

Extract:
1. Any commitments WE made (things we promised to do)
2. Content we shared (proposals, pricing, case studies, etc.)
3. Questions we asked
4. Overall tone
5. Whether we're expecting a response and when

Be specific about commitments - look for phrases like:
- "I'll send..."
- "I will..."
- "Let me..."
- "I'll follow up..."
- "Attached is..."
- "I'll get back to you..."

Return JSON matching this schema:
{
  "summary": "Brief summary of what we said",
  "commitments_made": [
    {
      "commitment": "What we promised to do",
      "deadline_mentioned": "Any deadline mentioned or null",
      "inferred_due_date": "YYYY-MM-DD if we can infer, or null"
    }
  ],
  "content_shared": [
    {
      "type": "proposal | pricing | case_study | contract | info | other",
      "description": "What was shared"
    }
  ],
  "questions_asked": ["Questions we asked"],
  "tone": "professional | friendly | urgent | apologetic | neutral",
  "follow_up_expected": {
    "expected": true,
    "expected_by": "timeframe or null",
    "what": "what response we expect or null"
  }
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as OutboundEmailAnalysis;
  } catch (err) {
    return null;
  }
}

// ============================================
// MAIN PROCESSING
// ============================================

async function main() {
  console.log('='.repeat(70));
  console.log('REPROCESS HISTORICAL DATA FOR COMPLETE RI POPULATION');
  console.log('='.repeat(70));
  console.log(`\nBatch size: ${BATCH_SIZE}\n`);

  // Step 1: Get current stats (BEFORE)
  console.log('--- STEP 1: Current Stats (BEFORE) ---\n');

  const statsBefore = await getCurrentStats();
  console.log('Commitments (ours):', statsBefore.commitmentsOurs);
  console.log('Commitments (theirs):', statsBefore.commitmentsTheirs);
  console.log('Buying signals:', statsBefore.buyingSignals);
  console.log('Concerns:', statsBefore.concerns);
  console.log('Tier 1 items:', statsBefore.tier1);
  console.log('Tier 2 items:', statsBefore.tier2);
  console.log('Tier 3 items:', statsBefore.tier3);
  console.log('Total CC items:', statsBefore.totalCC);

  // Step 2: Collect all items
  console.log('\n--- STEP 2: Collecting Items ---\n');

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // Get transcripts
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('user_id', userId)
    .gte('meeting_date', oneMonthAgo.toISOString())
    .not('analysis', 'is', null)
    .order('meeting_date', { ascending: true });

  console.log(`Found ${transcripts?.length || 0} transcripts with analysis`);

  // Get sent emails from activities (that haven't been processed yet)
  // We'll track which ones we've done by checking if they already created RI entries
  const { data: sentEmails } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'email_sent')
    .gte('occurred_at', oneMonthAgo.toISOString())
    .order('occurred_at', { ascending: true });

  console.log(`Found ${sentEmails?.length || 0} sent emails in activities`);

  // Load contacts and companies for matching
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, company_id');

  const contactsByEmail = new Map<string, any>();
  contacts?.forEach(c => {
    if (c.email) contactsByEmail.set(c.email.toLowerCase(), c);
  });

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name');

  const companiesById = new Map<string, string>();
  companies?.forEach(c => companiesById.set(c.id, c.name));

  // Combine and sort chronologically
  const allItems: SyncItem[] = [];

  for (const t of transcripts || []) {
    allItems.push({
      type: 'transcript',
      id: t.id,
      date: new Date(t.meeting_date),
      data: t,
    });
  }

  for (const e of sentEmails || []) {
    allItems.push({
      type: 'email',
      id: e.id,
      date: new Date(e.occurred_at),
      data: e,
    });
  }

  allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log(`Total items to process: ${allItems.length}`);

  // Step 3: Process in batches
  console.log('\n--- STEP 3: Processing (Chronological Order) ---\n');

  const stats: ProcessingStats = {
    transcriptsProcessed: 0,
    emailsProcessed: 0,
    commitmentsOursAdded: 0,
    commitmentsTheirsAdded: 0,
    buyingSignalsAdded: 0,
    concernsAdded: 0,
    errors: [],
  };

  let batchCount = 0;
  const totalBatches = Math.ceil(allItems.length / BATCH_SIZE);

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];

    try {
      if (item.type === 'transcript') {
        const interactionAnalysis = processTranscriptToInteractionAnalysis(item.data);
        if (interactionAnalysis) {
          const result = await updateRelationshipFromAnalysis(interactionAnalysis);
          if (result.success) {
            stats.transcriptsProcessed++;
            stats.commitmentsOursAdded += result.changes.ourCommitmentsAdded;
            stats.commitmentsTheirsAdded += result.changes.theirCommitmentsAdded;
            stats.buyingSignalsAdded += result.changes.buyingSignalsAdded;
            stats.concernsAdded += result.changes.concernsAdded;
          }
        }
      } else if (item.type === 'email') {
        // Extract recipient and context
        const metadata = item.data.metadata as any || {};
        const toEmails = metadata.to?.map((t: any) => t.address?.toLowerCase()) || [];
        const recipientEmail = toEmails[0];

        if (!recipientEmail) continue;

        const contact = contactsByEmail.get(recipientEmail);
        const contactId = contact?.id;
        const companyId = contact?.company_id || item.data.company_id;
        const companyName = companyId ? companiesById.get(companyId) : undefined;

        if (!contactId && !companyId) continue;

        // Analyze email
        const analysis = await analyzeOutboundEmail(
          item.data.subject || '(No subject)',
          item.data.body || '',
          recipientEmail,
          { contactName: contact?.name, companyName }
        );

        if (!analysis) continue;

        // Only update RI if we found commitments
        if (analysis.commitments_made.length > 0) {
          const interactionAnalysis: InteractionAnalysis = {
            type: 'email_outbound',
            source_id: item.data.id,
            contact_id: contactId || null,
            company_id: companyId || null,
            date: item.data.occurred_at,
            summary: analysis.summary,
            key_points: [
              ...(analysis.content_shared?.map(c => `Shared ${c.type}: ${c.description}`) || []),
              ...(analysis.questions_asked?.map(q => `Asked: ${q}`) || []),
            ],
            commitments_made: analysis.commitments_made.map(c => ({
              commitment: c.commitment,
              due_by: c.inferred_due_date,
            })),
          };

          const result = await updateRelationshipFromAnalysis(interactionAnalysis);
          if (result.success) {
            stats.emailsProcessed++;
            stats.commitmentsOursAdded += result.changes.ourCommitmentsAdded;
          }
        } else {
          stats.emailsProcessed++;
        }
      }
    } catch (err: any) {
      stats.errors.push(`${item.type} ${item.id}: ${err.message}`);
    }

    // Progress after each batch
    if ((i + 1) % BATCH_SIZE === 0 || i === allItems.length - 1) {
      batchCount++;
      const pct = Math.round(((i + 1) / allItems.length) * 100);
      console.log(`Batch ${batchCount}/${totalBatches} (${pct}%): ${stats.transcriptsProcessed} transcripts, ${stats.emailsProcessed} emails`);
      console.log(`  Commitments (ours): +${stats.commitmentsOursAdded}, (theirs): +${stats.commitmentsTheirsAdded}`);
      console.log(`  Buying signals: +${stats.buyingSignalsAdded}, Concerns: +${stats.concernsAdded}`);
    }
  }

  console.log('\n--- Processing Complete ---\n');
  console.log(`Transcripts processed: ${stats.transcriptsProcessed}`);
  console.log(`Emails processed: ${stats.emailsProcessed}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nSample errors:');
    stats.errors.slice(0, 3).forEach(e => console.log(`  - ${e}`));
  }

  // Step 4: Regenerate Command Center items
  console.log('\n--- STEP 4: Regenerating Command Center Items ---\n');

  // Clear existing Tier 2 and Tier 3 items with source = 'system'
  const { count: deletedT2 } = await supabase
    .from('command_center_items')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('tier', 2)
    .eq('source', 'system');

  const { count: deletedT3 } = await supabase
    .from('command_center_items')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('tier', 3)
    .eq('source', 'system');

  console.log(`Cleared ${deletedT2 || 0} Tier 2 items and ${deletedT3 || 0} Tier 3 items`);

  // Import and run createActionsFromCurrentState
  const { createActionsFromCurrentState } = await import('../src/lib/sync/initialHistoricalSync');
  const { createAdminClient } = await import('../src/lib/supabase/admin');

  const adminClient = createAdminClient();
  const ccResult = await createActionsFromCurrentState(
    adminClient,
    userId,
    (msg) => console.log(`  ${msg}`)
  );

  console.log(`\nCreated ${ccResult.itemsCreated} new CC items`);
  console.log(`  Tier 1: ${ccResult.tier1}, Tier 2: ${ccResult.tier2}, Tier 3: ${ccResult.tier3}, Tier 4: ${ccResult.tier4}`);

  // Step 5: Final stats (AFTER)
  console.log('\n--- STEP 5: Final Stats (AFTER) ---\n');

  const statsAfter = await getCurrentStats();

  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));

  console.log('\n| Metric | Before | After | Change |');
  console.log('|--------|--------|-------|--------|');
  console.log(`| Commitments (ours) | ${statsBefore.commitmentsOurs} | ${statsAfter.commitmentsOurs} | +${statsAfter.commitmentsOurs - statsBefore.commitmentsOurs} |`);
  console.log(`| Commitments (theirs) | ${statsBefore.commitmentsTheirs} | ${statsAfter.commitmentsTheirs} | +${statsAfter.commitmentsTheirs - statsBefore.commitmentsTheirs} |`);
  console.log(`| Buying signals | ${statsBefore.buyingSignals} | ${statsAfter.buyingSignals} | +${statsAfter.buyingSignals - statsBefore.buyingSignals} |`);
  console.log(`| Concerns | ${statsBefore.concerns} | ${statsAfter.concerns} | +${statsAfter.concerns - statsBefore.concerns} |`);
  console.log(`| Tier 1 items | ${statsBefore.tier1} | ${statsAfter.tier1} | ${statsAfter.tier1 - statsBefore.tier1} |`);
  console.log(`| Tier 2 items | ${statsBefore.tier2} | ${statsAfter.tier2} | ${statsAfter.tier2 - statsBefore.tier2} |`);
  console.log(`| Tier 3 items | ${statsBefore.tier3} | ${statsAfter.tier3} | ${statsAfter.tier3 - statsBefore.tier3} |`);
  console.log(`| Total CC items | ${statsBefore.totalCC} | ${statsAfter.totalCC} | ${statsAfter.totalCC - statsBefore.totalCC} |`);

  // Show sample rich RI records
  console.log('\n--- Sample Rich Relationship Intelligence Records ---\n');

  const { data: sampleRIs } = await supabase
    .from('relationship_intelligence')
    .select('id, contact_id, company_id, open_commitments, signals, relationship_summary')
    .not('open_commitments', 'is', null)
    .limit(10);

  // Find ones with the most data
  const richRIs = (sampleRIs || [])
    .map(ri => ({
      ...ri,
      score:
        (ri.open_commitments?.ours?.length || 0) +
        (ri.open_commitments?.theirs?.length || 0) +
        (ri.signals?.buying_signals?.length || 0) +
        (ri.signals?.concerns?.length || 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const ri of richRIs) {
    // Get company/contact name
    let name = 'Unknown';
    if (ri.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', ri.company_id)
        .single();
      name = company?.name || 'Unknown';
    }

    console.log(`\n--- ${name} ---`);
    console.log(`Summary: ${ri.relationship_summary || 'None'}`);
    console.log(`Our commitments: ${ri.open_commitments?.ours?.length || 0}`);
    if (ri.open_commitments?.ours?.length > 0) {
      ri.open_commitments.ours.slice(0, 2).forEach((c: any) => {
        console.log(`  - "${c.commitment.substring(0, 60)}..."`);
      });
    }
    console.log(`Their commitments: ${ri.open_commitments?.theirs?.length || 0}`);
    console.log(`Buying signals: ${ri.signals?.buying_signals?.length || 0}`);
    if (ri.signals?.buying_signals?.length > 0) {
      ri.signals.buying_signals.slice(0, 2).forEach((s: any) => {
        console.log(`  - [${s.strength}] ${s.signal}`);
      });
    }
    console.log(`Concerns: ${ri.signals?.concerns?.length || 0}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('REPROCESSING COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
