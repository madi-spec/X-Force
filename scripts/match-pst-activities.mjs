/**
 * PST Activity Matching Script
 * Uses AI to match imported PST emails and calendar events to deals
 *
 * Usage: node scripts/match-pst-activities.mjs [--limit N] [--skip-matched]
 *
 * This script:
 * 1. Fetches unmatched PST activities from the database
 * 2. Uses AI to match them to companies, deals, and contacts
 * 3. Updates activities with match results
 * 4. Creates review tasks for activities that need human review
 * 5. Marks non-deal-related activities as excluded
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  BATCH_SIZE: 5,                    // Process N activities at a time
  DELAY_BETWEEN_BATCHES_MS: 2000,   // Wait between batches to avoid rate limits
  MAX_ACTIVITIES_PER_RUN: 50,       // Limit per run to avoid long execution
  CONFIDENCE_THRESHOLD: 0.6,        // Below this, needs human review
  AUTO_EXCLUDE_PATTERNS: [          // Patterns to auto-exclude without AI
    /holiday/i,
    /united states$/i,
    /newsletter/i,
    /unsubscribe/i,
    /no-?reply/i,
    /automated/i,
    /notification/i,
    /out of office/i,
    /automatic reply/i,
  ],
};

// ============================================
// LOAD ENVIRONMENT VARIABLES
// ============================================
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.error('Could not load .env.local:', e.message);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ============================================
// PARSE COMMAND LINE ARGUMENTS
// ============================================
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit'));
const maxLimit = limitArg ? parseInt(limitArg.split('=')[1] || args[args.indexOf('--limit') + 1]) : CONFIG.MAX_ACTIVITIES_PER_RUN;
const skipMatched = args.includes('--skip-matched');

// ============================================
// HELPER FUNCTIONS
// ============================================

function shouldAutoExclude(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  return CONFIG.AUTO_EXCLUDE_PATTERNS.some(pattern => pattern.test(text));
}

async function getUnmatchedActivities(limit) {
  const { data, error } = await supabase
    .from('activities')
    .select('id, type, subject, body, occurred_at, metadata, external_id, deal_id, company_id')
    .like('external_id', 'pst_%')
    .or('match_status.is.null,match_status.eq.pending')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activities:', error.message);
    return [];
  }

  return data || [];
}

async function getEntitiesForMatching() {
  const [companiesResult, dealsResult, contactsResult] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, status, segment')
      .order('updated_at', { ascending: false })
      .limit(300),
    supabase
      .from('deals')
      .select('id, name, stage, company_id, company:companies(name)')
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('updated_at', { ascending: false })
      .limit(150),
    supabase
      .from('contacts')
      .select('id, name, email, company_id, company:companies(name)')
      .not('email', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500),
  ]);

  const companies = companiesResult.data || [];
  const deals = (dealsResult.data || []).map(d => {
    const company = Array.isArray(d.company) ? d.company[0] : d.company;
    return { ...d, company_name: company?.name || 'Unknown' };
  });
  const contacts = (contactsResult.data || []).map(c => {
    const company = Array.isArray(c.company) ? c.company[0] : c.company;
    return { ...c, company_name: company?.name || 'Unknown' };
  });

  return { companies, deals, contacts };
}

async function getSystemUserId() {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();
  return user?.id || null;
}

function quickMatchByEmail(activity, contacts) {
  const emails = [
    activity.metadata?.fromEmail,
    ...(activity.metadata?.to || []),
    ...(activity.metadata?.cc || []),
    ...(activity.metadata?.attendees || []),
    activity.metadata?.organizer,
  ].filter(Boolean).map(e => e.toLowerCase());

  for (const email of emails) {
    const match = contacts.find(c => c.email && c.email.toLowerCase() === email);
    if (match) {
      return { contactId: match.id, companyId: match.company_id, contactName: match.name };
    }
  }
  return null;
}

async function findDealForCompany(companyId) {
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name')
    .eq('company_id', companyId)
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('updated_at', { ascending: false })
    .limit(1);

  return deals?.[0] || null;
}

async function matchActivityWithAI(activity, entities) {
  const { companies, deals, contacts } = entities;

  const activityType = activity.type === 'meeting' ? 'Calendar Event' :
    activity.type === 'email_sent' ? 'Sent Email' : 'Received Email';

  const participants = [
    activity.metadata?.fromEmail,
    ...(activity.metadata?.to || []),
    ...(activity.metadata?.attendees || []),
  ].filter(Boolean).join(', ');

  // Truncate body
  const body = (activity.body || '').slice(0, 3000);

  // Build context lists (smaller for performance)
  const companyList = companies.slice(0, 50).map(c => `${c.name} (ID:${c.id})`).join('\n');
  const dealList = deals.slice(0, 50).map(d => `${d.name} @ ${d.company_name} (ID:${d.id})`).join('\n');
  const contactList = contacts.slice(0, 100).map(c => `${c.name} <${c.email}> @ ${c.company_name}`).join('\n');

  const prompt = `Analyze this ${activityType} and determine:
1. Is this relevant to a sales deal? (not newsletters, notifications, personal emails)
2. Which company and deal should it be associated with?

## Activity
- Type: ${activityType}
- Subject: ${activity.subject}
- Date: ${activity.occurred_at}
- Participants: ${participants || 'Unknown'}
${activity.metadata?.folder ? `- Folder: ${activity.metadata.folder}` : ''}

## Content
${body || '(No content)'}

## Known Contacts
${contactList || 'None'}

## Companies
${companyList || 'None'}

## Active Deals
${dealList || 'None'}

Respond with JSON only:
{
  "isRelevantToDeal": true/false,
  "excludeReason": "reason if not relevant, else null",
  "companyId": "UUID or null",
  "companyName": "name or null",
  "dealId": "UUID or null",
  "dealName": "name or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "requiresHumanReview": true/false,
  "reviewReason": "reason if needs review, else null"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate IDs exist
    if (result.companyId && !companies.find(c => c.id === result.companyId)) {
      result.companyId = null;
      result.companyName = null;
      result.requiresHumanReview = true;
      result.reviewReason = 'AI returned invalid company ID';
    }

    if (result.dealId && !deals.find(d => d.id === result.dealId)) {
      result.dealId = null;
      result.dealName = null;
      result.requiresHumanReview = true;
      result.reviewReason = 'AI returned invalid deal ID';
    }

    return result;
  } catch (error) {
    console.error(`  AI error for "${activity.subject}":`, error.message);
    return {
      isRelevantToDeal: true,
      excludeReason: null,
      companyId: null,
      dealId: null,
      confidence: 0,
      reasoning: `AI analysis failed: ${error.message}`,
      requiresHumanReview: true,
      reviewReason: 'AI analysis failed',
    };
  }
}

async function updateActivityMatch(activityId, matchResult, quickMatch = null) {
  const updateData = {
    match_confidence: matchResult.confidence,
    match_reasoning: matchResult.reasoning,
    matched_at: new Date().toISOString(),
  };

  if (!matchResult.isRelevantToDeal) {
    updateData.match_status = 'excluded';
    updateData.exclude_reason = matchResult.excludeReason;
  } else if (matchResult.dealId) {
    updateData.match_status = 'matched';
    updateData.deal_id = matchResult.dealId;
    if (matchResult.companyId) {
      updateData.company_id = matchResult.companyId;
    }
  } else if (matchResult.requiresHumanReview) {
    updateData.match_status = 'review_needed';
    if (matchResult.companyId) {
      updateData.company_id = matchResult.companyId;
    }
  } else {
    updateData.match_status = 'unmatched';
  }

  // Apply quick match contact's company if available
  if (quickMatch?.companyId && !updateData.company_id) {
    updateData.company_id = quickMatch.companyId;
  }

  const { error } = await supabase
    .from('activities')
    .update(updateData)
    .eq('id', activityId);

  if (error) {
    console.error(`  Failed to update activity ${activityId}:`, error.message);
    return false;
  }

  return true;
}

async function createReviewTask(activity, matchResult, userId) {
  const activityType = activity.type === 'meeting' ? 'Calendar Event' :
    activity.type === 'email_sent' ? 'Sent Email' : 'Received Email';

  const description = [
    `A ${activityType.toLowerCase()} needs manual review to determine deal assignment.`,
    '',
    `**Subject:** ${activity.subject}`,
    `**Date:** ${activity.occurred_at}`,
    '',
    `**AI Analysis:** ${matchResult.reasoning}`,
    `**Confidence:** ${(matchResult.confidence * 100).toFixed(0)}%`,
    matchResult.reviewReason ? `**Review Reason:** ${matchResult.reviewReason}` : '',
    '',
    '**Options:**',
    '1. Find the correct deal and update the activity',
    '2. Mark as excluded if not relevant to sales',
    '',
    `**Activity ID:** ${activity.id}`,
  ].filter(Boolean).join('\n');

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const { error } = await supabase
    .from('tasks')
    .insert({
      company_id: matchResult.companyId || null,
      assigned_to: userId,
      type: 'review',
      title: `Review ${activityType.toLowerCase()}: ${(activity.subject || '').slice(0, 50)}`,
      description,
      priority: 'medium',
      due_at: dueDate.toISOString(),
      source: 'ai_recommendation',
    });

  if (error) {
    console.error(`  Failed to create task for ${activity.id}:`, error.message);
    return false;
  }

  return true;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(50));
  console.log('PST ACTIVITY MATCHING');
  console.log('='.repeat(50));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Limit: ${maxLimit} activities`);
  console.log('');

  // Get system user for task assignment
  const userId = await getSystemUserId();
  if (!userId) {
    console.error('ERROR: Could not get system user ID');
    process.exit(1);
  }

  // Fetch unmatched activities
  console.log('Fetching unmatched PST activities...');
  const activities = await getUnmatchedActivities(maxLimit);

  if (activities.length === 0) {
    console.log('No unmatched activities found.');
    return;
  }

  console.log(`Found ${activities.length} activities to process`);
  console.log('');

  // Fetch entities for matching
  console.log('Loading companies, deals, and contacts...');
  const entities = await getEntitiesForMatching();
  console.log(`  ${entities.companies.length} companies, ${entities.deals.length} deals, ${entities.contacts.length} contacts`);
  console.log('');

  // Process activities
  const stats = {
    matched: 0,
    excluded: 0,
    reviewNeeded: 0,
    unmatched: 0,
    errors: 0,
    autoExcluded: 0,
    quickMatched: 0,
  };

  console.log('Processing activities...');

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    const progress = `[${i + 1}/${activities.length}]`;

    // Skip already matched if flag set
    if (skipMatched && activity.deal_id) {
      console.log(`${progress} Skipping already matched: ${activity.subject?.slice(0, 40)}`);
      continue;
    }

    // Check for auto-exclude patterns
    if (shouldAutoExclude(activity.subject || '', activity.body || '')) {
      console.log(`${progress} Auto-excluding: ${activity.subject?.slice(0, 40)}`);
      await updateActivityMatch(activity.id, {
        isRelevantToDeal: false,
        excludeReason: 'Auto-excluded by pattern match',
        confidence: 1.0,
        reasoning: 'Matched auto-exclude pattern (holiday, newsletter, notification, etc.)',
        requiresHumanReview: false,
      });
      stats.autoExcluded++;
      continue;
    }

    // Try quick email-based matching first
    const quickMatch = quickMatchByEmail(activity, entities.contacts);
    if (quickMatch) {
      // Found a contact match, now find a deal for their company
      const deal = await findDealForCompany(quickMatch.companyId);
      if (deal) {
        console.log(`${progress} Quick matched to ${deal.name}: ${activity.subject?.slice(0, 30)}`);
        await updateActivityMatch(activity.id, {
          isRelevantToDeal: true,
          companyId: quickMatch.companyId,
          dealId: deal.id,
          dealName: deal.name,
          confidence: 0.9,
          reasoning: `Matched via contact email: ${quickMatch.contactName}`,
          requiresHumanReview: false,
        }, quickMatch);
        stats.quickMatched++;
        stats.matched++;
        continue;
      }
    }

    // Use AI for matching
    console.log(`${progress} AI matching: ${activity.subject?.slice(0, 40)}`);
    const matchResult = await matchActivityWithAI(activity, entities);

    // Update the activity
    const updated = await updateActivityMatch(activity.id, matchResult, quickMatch);

    if (!updated) {
      stats.errors++;
      continue;
    }

    // Track stats
    if (!matchResult.isRelevantToDeal) {
      stats.excluded++;
      console.log(`${progress}   → Excluded: ${matchResult.excludeReason}`);
    } else if (matchResult.dealId) {
      stats.matched++;
      console.log(`${progress}   → Matched to: ${matchResult.dealName}`);
    } else if (matchResult.requiresHumanReview) {
      stats.reviewNeeded++;
      console.log(`${progress}   → Needs review: ${matchResult.reviewReason}`);
      await createReviewTask(activity, matchResult, userId);
    } else {
      stats.unmatched++;
      console.log(`${progress}   → Unmatched (no deal found)`);
    }

    // Delay between AI calls
    if (i < activities.length - 1 && (i + 1) % CONFIG.BATCH_SIZE === 0) {
      await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_BATCHES_MS));
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('='.repeat(50));
  console.log('MATCHING COMPLETE');
  console.log('='.repeat(50));
  console.log(`Matched to deals: ${stats.matched} (${stats.quickMatched} quick, ${stats.matched - stats.quickMatched} AI)`);
  console.log(`Excluded (not deal-related): ${stats.excluded} (${stats.autoExcluded} auto)`);
  console.log(`Needs human review: ${stats.reviewNeeded}`);
  console.log(`Unmatched: ${stats.unmatched}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Duration: ${duration} seconds`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
