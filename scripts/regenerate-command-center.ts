/**
 * Regenerate Command Center Items
 *
 * Processes all emails and transcripts to regenerate command center items
 * using the new workflow card system with auto-linking.
 *
 * Run with: npx tsx scripts/regenerate-command-center.ts
 * Check counts only: npx tsx scripts/regenerate-command-center.ts --check
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Must set API key before importing modules that use Anthropic
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const checkOnly = process.argv.includes('--check');
  const limit = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;

  console.log('='.repeat(80));
  console.log('COMMAND CENTER REGENERATION');
  console.log('='.repeat(80));
  console.log(`Mode: ${checkOnly ? 'CHECK ONLY' : 'REGENERATE'}`);
  if (limit) console.log(`Limit: ${limit} items`);
  console.log('');

  const supabase = createAdminClient();

  // Step 1: Check data counts
  console.log('--- Step 1: Data Inventory ---\n');

  // Emails
  const { count: emailCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true });

  const { count: inboundEmailCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .not('from_email', 'ilike', '%@affiliatedtech.com%')
    .not('from_email', 'ilike', '%xraisales%');

  const { count: analyzedEmailCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .eq('analysis_complete', true);

  console.log(`Emails:`);
  console.log(`  Total: ${emailCount}`);
  console.log(`  Inbound (from prospects): ${inboundEmailCount}`);
  console.log(`  Already analyzed: ${analyzedEmailCount}`);

  // Transcripts
  const { count: transcriptCount } = await supabase
    .from('meeting_transcriptions')
    .select('*', { count: 'exact', head: true });

  const { count: analyzedTranscriptCount } = await supabase
    .from('meeting_transcriptions')
    .select('*', { count: 'exact', head: true })
    .not('analysis', 'is', null);

  console.log(`\nTranscripts:`);
  console.log(`  Total: ${transcriptCount}`);
  console.log(`  Already analyzed: ${analyzedTranscriptCount}`);

  // Contacts, Companies, Deals
  const { count: contactCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true });

  const { count: companyCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  const { count: dealCount } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true });

  console.log(`\nEntities:`);
  console.log(`  Contacts: ${contactCount}`);
  console.log(`  Companies: ${companyCount}`);
  console.log(`  Deals: ${dealCount}`);

  // Existing command center items
  const { count: existingItemCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress']);

  const { count: itemsWithHash } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .not('source_hash', 'is', null);

  console.log(`\nCommand Center Items:`);
  console.log(`  Active (pending/in_progress): ${existingItemCount}`);
  console.log(`  With source_hash: ${itemsWithHash}`);

  if (checkOnly) {
    console.log('\n' + '='.repeat(80));
    console.log('CHECK COMPLETE - Run without --check to regenerate');
    console.log('='.repeat(80));
    return;
  }

  // Step 2: Get user ID - must get a user with auth_id for items to show in UI
  const { data: user } = await supabase
    .from('users')
    .select('id, email, auth_id')
    .not('auth_id', 'is', null)
    .limit(1)
    .single();

  if (!user) {
    console.log('No user with auth_id found! Items will not be visible in UI.');
    return;
  }

  console.log(`\n--- Step 2: Processing with user ${user.email} (${user.id}) ---\n`);
  console.log(`   auth_id: ${user.auth_id}\n`);

  // Step 3: Process analyzed emails to create command center items
  // We'll use the existing ai_analysis to create items without re-analyzing
  console.log('Processing emails with existing analysis...\n');

  const { data: analyzedEmails, error: emailQueryError } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, from_name, ai_analysis, received_at, conversation_ref')
    .eq('analysis_complete', true)
    .not('ai_analysis', 'is', null)
    .order('received_at', { ascending: false })
    .limit(limit || 500);

  if (emailQueryError) {
    console.error('  Email query error:', emailQueryError);
  }

  let emailsProcessed = 0;
  let itemsCreated = 0;
  let duplicatesSkipped = 0;
  let itemsNeedingReanalysis = 0;
  const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  console.log(`  Found ${analyzedEmails?.length || 0} analyzed emails to process`);

  for (const email of analyzedEmails || []) {
    try {
      const analysis = email.ai_analysis as any;
      if (!analysis) {
        console.log(`  Skipping ${email.id}: no analysis`);
        continue;
      }

      // Handle both new format (required_actions) and old format (commitments_made, follow_up_expected)
      let actions: any[] = [];
      let commType = analysis.communication_type || 'email_response';

      if (analysis.required_actions?.length) {
        // New format
        actions = analysis.required_actions;
      } else {
        // Old format - extract actions from commitments and follow-ups
        if (analysis.commitments_made?.length) {
          actions.push(...analysis.commitments_made.map((c: any) => ({
            action: typeof c === 'string' ? c : (c.commitment || c.description || JSON.stringify(c)),
            owner: 'sales_rep',
            urgency: c.deadline_mentioned ? 'high' : 'medium',
          })));
        }
        if (analysis.follow_up_expected) {
          const followUp = analysis.follow_up_expected;
          // Handle boolean true, string descriptions, or object format
          let followUpText: string | null = null;
          if (typeof followUp === 'boolean' && followUp) {
            followUpText = 'Follow up on this conversation';
          } else if (typeof followUp === 'string' && followUp !== 'none' && followUp !== 'null' && followUp !== 'true') {
            followUpText = followUp;
          } else if (typeof followUp === 'object' && followUp) {
            const extracted = followUp.description || followUp.expected || followUp.action;
            followUpText = typeof extracted === 'string' ? extracted : null;
          }

          if (followUpText && typeof followUpText === 'string') {
            const actionText = followUpText.startsWith('Follow up') ? followUpText : `Follow up: ${followUpText}`;
            actions.push({
              action: actionText,
              owner: 'sales_rep',
              urgency: 'medium',
            });
          }
        }
        if (analysis.questions_asked?.length) {
          actions.push(...analysis.questions_asked.map((q: any) => ({
            action: `Address question: ${typeof q === 'string' ? q : (q.question || JSON.stringify(q))}`,
            owner: 'sales_rep',
            urgency: 'high',
          })));
        }
        commType = 'email_response';
      }

      if (!actions.length) {
        // console.log(`  Skipping ${email.id}: no actions extracted`);
        continue;
      }
      console.log(`  Processing ${email.id}: ${actions.length} actions found`);

      // Generate source hash
      const sourceHash = hashString(`email|${email.id}|${analysis.communication_type || 'unknown'}`);

      // Check if already processed
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('source_hash', sourceHash)
        .limit(1);

      if (existing?.length) {
        duplicatesSkipped++;
        continue;
      }

      // Find contact by email
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, company_id')
        .eq('email', email.from_email)
        .limit(1)
        .single();

      // Get tier from AI analysis ONLY - no keyword fallbacks
      const { tier, tierTrigger, whyNow, needsReanalysis } = getTierFromAIAnalysis(
        analysis,
        commType
      );

      // Track items that need reanalysis
      if (needsReanalysis) {
        itemsNeedingReanalysis++;
      }

      if (actions.length > 1) {
        // Create workflow card
        const workflowSteps = actions.map((action: any, i: number) => ({
          id: `step-${i + 1}-${Date.now()}`,
          title: action.action,
          owner: action.owner || 'sales_rep',
          urgency: action.urgency || 'medium',
          completed: false,
          completed_at: null,
        }));

        const workflowTitles: Record<string, string> = {
          'free_trial_form': 'Process Trial Form Submission',
          'demo_request': 'Handle Demo Request',
          'pricing_request': 'Respond to Pricing Inquiry',
          'proposal_follow_up': 'Follow Up on Proposal',
          'meeting_follow_up': 'Complete Meeting Follow-ups',
          'contract_negotiation': 'Advance Contract Discussion',
          'question_inquiry': 'Address Customer Questions',
        };

        const title = workflowTitles[commType] ||
          `Process ${(commType || 'response').replace(/_/g, ' ')}`;

        const { error } = await supabase.from('command_center_items').insert({
          user_id: user.id,
          contact_id: contact?.id || null,
          company_id: contact?.company_id || null,
          conversation_id: email.conversation_ref,
          email_id: email.id,
          title: title,
          description: analysis.summary,
          tier: tier,
          tier_trigger: tierTrigger,
          why_now: whyNow,
          action_type: 'workflow',
          status: 'pending',
          source: 'ai_recommendation',
          source_hash: sourceHash,
          workflow_steps: workflowSteps,
          momentum_score: 100 - (tier * 15),
          estimated_minutes: workflowSteps.length * 10,
          received_at: email.received_at,
          created_at: new Date().toISOString(),
        });

        if (!error) {
          itemsCreated++;
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        }
      } else {
        // Create single item
        const action = actions[0];
        const { error } = await supabase.from('command_center_items').insert({
          user_id: user.id,
          contact_id: contact?.id || null,
          company_id: contact?.company_id || null,
          conversation_id: email.conversation_ref,
          email_id: email.id,
          title: action.action,
          description: action.reasoning || analysis.summary,
          tier: tier,
          tier_trigger: tierTrigger,
          why_now: whyNow,
          action_type: 'task_simple',
          status: 'pending',
          source: 'ai_recommendation',
          source_hash: sourceHash,
          momentum_score: 100 - (tier * 15),
          estimated_minutes: 15,
          received_at: email.received_at,
          created_at: new Date().toISOString(),
        });

        if (!error) {
          itemsCreated++;
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        }
      }

      emailsProcessed++;

      if (emailsProcessed % 50 === 0) {
        console.log(`  Processed ${emailsProcessed} emails, created ${itemsCreated} items...`);
      }
    } catch (err) {
      console.error(`  Error processing email ${email.id}:`, err);
    }
  }

  console.log(`\nEmails: ${emailsProcessed} processed, ${itemsCreated} items created, ${duplicatesSkipped} duplicates skipped`);
  if (itemsNeedingReanalysis > 0) {
    console.log(`  ⚠️  ${itemsNeedingReanalysis} items need AI reanalysis (old format, no tier classification)`);
  }

  // Load all companies for auto-linking by title extraction
  console.log('\nLoading companies for auto-linking...');
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name');
  console.log(`  Loaded ${allCompanies?.length || 0} companies`);

  // Step 4: Process transcripts
  console.log('\nProcessing transcripts with existing analysis...\n');

  const { data: analyzedTranscripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, analysis, meeting_date')
    .not('analysis', 'is', null)
    .order('meeting_date', { ascending: false })
    .limit(limit || 200);

  let transcriptsProcessed = 0;
  let transcriptsLinkedToCompany = 0;

  for (const transcript of analyzedTranscripts || []) {
    try {
      const analysis = transcript.analysis as any;
      if (!analysis) continue;

      // Get action items from analysis
      const actionItems = analysis.actionItems || analysis.action_items || [];
      const ourCommitments = analysis.ourCommitments || [];
      const allActions = [...actionItems, ...ourCommitments.map((c: any) => ({
        action: c.commitment || c.description,
        owner: 'sales_rep',
        urgency: 'medium',
      }))];

      if (!allActions.length) continue;

      // Generate source hash
      const sourceHash = hashString(`transcript|${transcript.id}|meeting`);

      // Check if already processed
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('source_hash', sourceHash)
        .limit(1);

      if (existing?.length) {
        duplicatesSkipped++;
        continue;
      }

      // Create workflow card for meeting follow-ups
      const workflowSteps = allActions.slice(0, 5).map((action: any, i: number) => ({
        id: `step-${i + 1}-${Date.now()}`,
        // Handle different property names: task (actionItems), commitment (ourCommitments), action, description
        title: typeof action === 'string' ? action : (action.task || action.commitment || action.action || action.description || 'Action item'),
        owner: action.owner || (action.assignee ? 'sales_rep' : 'sales_rep'),
        urgency: action.urgency || action.priority || 'medium',
        completed: false,
        completed_at: null,
      }));

      // Get tier from transcript analysis - no keyword fallbacks
      const { tier: meetingTier, tierTrigger: meetingTrigger, whyNow: meetingWhyNow } = getTierForTranscript(
        analysis,
        allActions
      );

      // Extract company from transcript title for auto-linking
      const matchedCompany = extractCompanyFromTitle(transcript.title || '', allCompanies || []);

      const { error } = await supabase.from('command_center_items').insert({
        user_id: user.id,
        meeting_id: transcript.id,
        company_id: matchedCompany?.id || null,
        title: `Meeting Follow-ups: ${transcript.title?.substring(0, 40) || 'Call'}`,
        description: analysis.summary || `Follow up on ${workflowSteps.length} action items from this call.`,
        tier: meetingTier,
        tier_trigger: meetingTrigger,
        why_now: meetingWhyNow || `${workflowSteps.length} commitments from your call need follow-up.`,
        action_type: 'workflow',
        status: 'pending',
        source: 'transcription',
        source_hash: sourceHash,
        workflow_steps: workflowSteps,
        momentum_score: 70,
        estimated_minutes: workflowSteps.length * 10,
        received_at: transcript.meeting_date,
        created_at: new Date().toISOString(),
      });

      if (!error) {
        itemsCreated++;
        tierCounts[meetingTier] = (tierCounts[meetingTier] || 0) + 1;
        transcriptsProcessed++;
        if (matchedCompany) {
          transcriptsLinkedToCompany++;
        }
      }

      if (transcriptsProcessed % 20 === 0) {
        console.log(`  Processed ${transcriptsProcessed} transcripts...`);
      }
    } catch (err) {
      console.error(`  Error processing transcript ${transcript.id}:`, err);
    }
  }

  console.log(`\nTranscripts: ${transcriptsProcessed} processed`);
  if (transcriptsLinkedToCompany > 0) {
    console.log(`  ✓ ${transcriptsLinkedToCompany} transcripts linked to companies via title extraction`);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('REGENERATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nTotal emails processed: ${emailsProcessed}`);
  console.log(`Total transcripts processed: ${transcriptsProcessed}`);
  console.log(`Total items created: ${itemsCreated}`);
  console.log(`Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`\nBreakdown by tier:`);
  Object.entries(tierCounts).forEach(([tier, count]) => {
    if (count > 0) {
      const tierNames: Record<string, string> = {
        '1': 'RESPOND NOW',
        '2': "DON'T LOSE THIS",
        '3': 'KEEP YOUR WORD',
        '4': 'MOVE BIG DEALS',
        '5': 'BUILD PIPELINE',
      };
      console.log(`  Tier ${tier} (${tierNames[tier]}): ${count}`);
    }
  });

  // Final count
  const { count: finalCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress']);

  console.log(`\nFinal active items in command center: ${finalCount}`);

  if (itemsNeedingReanalysis > 0) {
    console.log(`\n⚠️  NOTE: ${itemsNeedingReanalysis} items have tier 'needs_ai_classification'`);
    console.log(`   These items have old-format analysis without command_center_classification.`);
    console.log(`   Run a reanalysis script to properly classify them with AI.`);
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Get tier from AI analysis ONLY - no keyword fallbacks
 *
 * If AI classification is not available, returns needs_reanalysis tier.
 * The AI should do classification via the playbook, not regex/includes in code.
 */
function getTierFromAIAnalysis(
  analysis: any,
  commType: string
): { tier: number; tierTrigger: string; whyNow: string | null; needsReanalysis: boolean } {
  // ONLY use AI-provided classification
  if (analysis.command_center_classification?.tier) {
    return {
      tier: analysis.command_center_classification.tier,
      tierTrigger: analysis.command_center_classification.tier_trigger || commType,
      whyNow: analysis.command_center_classification.why_now || null,
      needsReanalysis: false,
    };
  }

  // No AI classification available - mark for reanalysis
  // Default to Tier 5 (lowest priority) until properly classified by AI
  return {
    tier: 5,
    tierTrigger: 'needs_ai_classification',
    whyNow: null,
    needsReanalysis: true,
  };
}

/**
 * Get tier for transcript - uses analysis metadata only, no keywords
 */
function getTierForTranscript(
  analysis: any,
  actions: any[]
): { tier: number; tierTrigger: string; whyNow: string | null } {
  // Meetings with commitments go to Tier 3 (KEEP YOUR WORD)
  const commitmentCount = (analysis.ourCommitments?.length || 0) +
    (analysis.actionItems?.filter((a: any) => a.owner === 'us').length || 0);

  if (commitmentCount > 0) {
    return {
      tier: 3,
      tierTrigger: 'meeting_commitment',
      whyNow: `${commitmentCount} commitment(s) from your call`,
    };
  }

  // Meetings with action items (any owner) go to Tier 5
  if (actions.length > 0) {
    return {
      tier: 5,
      tierTrigger: 'meeting_follow_up',
      whyNow: null,
    };
  }

  // No actions - Tier 5
  return {
    tier: 5,
    tierTrigger: 'general_meeting',
    whyNow: null,
  };
}

/**
 * Extract company name from item title for auto-linking
 * Uses fuzzy matching to handle partial matches like "BHB Pest Control" -> "BHB Pest Elimination LLC"
 */
function extractCompanyFromTitle(title: string, companies: { id: string; name: string }[]): { id: string; name: string } | null {
  const titleLower = title.toLowerCase();

  // Sort by name length (longest first) to match "Harris Pest Control" before "Harris"
  const sortedCompanies = [...companies].sort((a, b) => b.name.length - a.name.length);

  // First pass: exact substring match
  for (const company of sortedCompanies) {
    const companyLower = company.name.toLowerCase();
    if (titleLower.includes(companyLower)) {
      return company;
    }
  }

  // Second pass: check if company name's significant words appear in title
  // This catches "Palisade" matching "Palisade Pest" and "BHB Pest Control" matching "BHB Pest Elimination"
  for (const company of sortedCompanies) {
    const companyLower = company.name.toLowerCase();
    // Skip generic names that would match too broadly
    if (['external contacts', 'pest control', 'services', 'pest'].includes(companyLower)) {
      continue;
    }

    // Get the first significant word (usually the distinctive company name)
    const companyWords = companyLower.split(/\s+/).filter(w => w.length > 2);
    const significantWord = companyWords[0];

    // If the title contains the company's first word and either "pest" or another identifier
    if (significantWord && titleLower.includes(significantWord)) {
      // Check for additional overlap to avoid false positives
      const overlap = companyWords.filter(w => titleLower.includes(w)).length;
      if (overlap >= 1) {
        return company;
      }
    }
  }

  return null;
}

main().catch(console.error);
