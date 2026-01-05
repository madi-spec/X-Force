/**
 * Migrate Historical Sent Emails for Commitment Detection
 *
 * Processes sent emails from activities table and extracts commitments
 * to update relationship intelligence.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import {
  updateRelationshipFromAnalysis,
  fromOutboundEmailAnalysis,
} from '../src/lib/intelligence/updateRelationshipFromAnalysis';

// Initialize Anthropic after dotenv loads
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';
const BATCH_SIZE = parseInt(process.argv[2] || '50', 10);

interface OutboundEmailAnalysis {
  summary: string;
  commitments_made: Array<{
    commitment: string;
    deadline_mentioned: string | null;
    inferred_due_date: string | null;
  }>;
  content_shared: Array<{
    type: string;
    description: string;
  }>;
  questions_asked: string[];
  tone: string;
  follow_up_expected: {
    expected: boolean;
    expected_by: string | null;
    what: string | null;
  };
}

async function analyzeOutboundEmailText(
  subject: string,
  body: string,
  toEmail: string,
  context: { contactName?: string; companyName?: string }
): Promise<OutboundEmailAnalysis | null> {
  const prompt = `Analyze this outbound sales email to extract commitments, content shared, and follow-up expectations.

RECIPIENT: ${context.contactName || toEmail} at ${context.companyName || 'Unknown Company'}

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
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response');
      return null;
    }

    return JSON.parse(jsonMatch[0]) as OutboundEmailAnalysis;
  } catch (err) {
    console.error('AI analysis error:', err);
    return null;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('MIGRATE SENT EMAILS FOR COMMITMENT DETECTION');
  console.log('='.repeat(70));
  console.log(`\nBatch size: ${BATCH_SIZE}\n`);

  // Step 1: Get sent emails from activities table
  console.log('--- Step 1: Fetching Sent Emails from Activities ---\n');

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const { data: sentEmails, error: fetchError } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'email_sent')
    .gte('occurred_at', oneMonthAgo.toISOString())
    .order('occurred_at', { ascending: true }) // Chronological
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error('Error fetching activities:', fetchError.message);
    return;
  }

  console.log(`Found ${sentEmails?.length || 0} sent emails in activities table`);

  if (!sentEmails || sentEmails.length === 0) {
    console.log('No sent emails to process');
    return;
  }

  // Show sample structure
  const sample = sentEmails[0];
  console.log('\nSample activity structure:');
  console.log('  Subject:', sample.subject);
  console.log('  Body preview:', sample.body?.substring(0, 100));
  console.log('  Occurred at:', sample.occurred_at);
  console.log('  Metadata keys:', Object.keys(sample.metadata || {}));

  // Step 2: Get contacts for matching
  console.log('\n--- Step 2: Loading Contact Data ---\n');

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, company_id');

  const contactsByEmail = new Map<string, any>();
  contacts?.forEach(c => {
    if (c.email) {
      contactsByEmail.set(c.email.toLowerCase(), c);
    }
  });

  console.log(`Loaded ${contactsByEmail.size} contacts for matching`);

  // Get companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name');

  const companiesById = new Map<string, string>();
  companies?.forEach(c => companiesById.set(c.id, c.name));

  // Step 3: Process each email
  console.log('\n--- Step 3: Processing Emails for Commitments ---\n');

  let processed = 0;
  let commitmentsFound = 0;
  let riUpdates = 0;
  const errors: string[] = [];
  const sampleCommitments: Array<{ email: string; commitment: string; company: string }> = [];

  for (const activity of sentEmails) {
    processed++;

    // Extract recipient email from metadata
    const metadata = activity.metadata as any || {};
    const toEmails = metadata.to?.map((t: any) => t.address?.toLowerCase()) || [];
    const recipientEmail = toEmails[0];

    if (!recipientEmail) {
      continue; // Skip if no recipient
    }

    // Find contact
    const contact = contactsByEmail.get(recipientEmail);
    const contactId = contact?.id;
    const companyId = contact?.company_id || activity.company_id;
    const companyName = companyId ? companiesById.get(companyId) : undefined;
    const contactName = contact?.name;

    if (!contactId && !companyId) {
      continue; // Skip if we can't link to anything
    }

    // Analyze the email
    const analysis = await analyzeOutboundEmailText(
      activity.subject || '(No subject)',
      activity.body || '',
      recipientEmail,
      { contactName, companyName }
    );

    if (!analysis) {
      errors.push(`Failed to analyze: ${activity.subject?.substring(0, 30)}`);
      continue;
    }

    // Count commitments
    const emailCommitments = analysis.commitments_made?.length || 0;
    commitmentsFound += emailCommitments;

    // Store sample commitments
    if (emailCommitments > 0 && sampleCommitments.length < 10) {
      for (const c of analysis.commitments_made) {
        sampleCommitments.push({
          email: activity.subject || '(No subject)',
          commitment: c.commitment,
          company: companyName || 'Unknown',
        });
      }
    }

    // Update relationship intelligence if we found commitments
    if (emailCommitments > 0 && (contactId || companyId)) {
      try {
        const interactionAnalysis = fromOutboundEmailAnalysis(
          activity.id,
          contactId || undefined,
          companyId || undefined,
          activity.occurred_at,
          {
            summary: analysis.summary,
            commitments_made: analysis.commitments_made.map(c => ({
              commitment: c.commitment,
              inferred_due_date: c.inferred_due_date || null,
            })),
            content_shared: analysis.content_shared,
            questions_asked: analysis.questions_asked,
          }
        );

        await updateRelationshipFromAnalysis(interactionAnalysis);
        riUpdates++;
      } catch (err: any) {
        errors.push(`RI update failed: ${err.message}`);
      }
    }

    // Progress
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${sentEmails.length} (${commitmentsFound} commitments found)`);
    }
  }

  // Step 4: Results
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));

  console.log(`\nEmails processed: ${processed}`);
  console.log(`Commitments found: ${commitmentsFound}`);
  console.log(`RI updates made: ${riUpdates}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nSample errors:');
    errors.slice(0, 3).forEach(e => console.log(`  - ${e}`));
  }

  // Step 5: Sample commitments
  console.log('\n--- Sample Commitments from Emails ---\n');

  sampleCommitments.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. "${c.commitment}"`);
    console.log(`   From: ${c.email.substring(0, 50)}`);
    console.log(`   Company: ${c.company}`);
    console.log();
  });

  // Step 6: Updated RI stats
  console.log('--- Updated RI Commitment Stats ---\n');

  const { data: riData } = await supabase
    .from('relationship_intelligence')
    .select('open_commitments')
    .not('open_commitments', 'is', null);

  let totalOurs = 0;
  let pendingOurs = 0;

  for (const ri of riData || []) {
    const ours = ri.open_commitments?.ours || [];
    totalOurs += ours.length;
    pendingOurs += ours.filter((c: any) => c.status === 'pending').length;
  }

  console.log(`Total 'our' commitments: ${totalOurs}`);
  console.log(`Pending commitments: ${pendingOurs}`);

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
