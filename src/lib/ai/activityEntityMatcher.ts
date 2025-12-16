/**
 * AI-powered entity matching for email and calendar activities
 * Analyzes activity content to determine company, deal, and contact associations
 */

import { callAIJson, logAIUsage } from './core/aiClient';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ActivityMatchCandidate {
  id: string;
  name: string;
  matchScore: number;
  matchReasons: string[];
}

export interface AIActivityMatchResult {
  companyMatch: ActivityMatchCandidate | null;
  dealMatch: ActivityMatchCandidate | null;
  contactMatch: ActivityMatchCandidate | null;
  overallConfidence: number;
  reasoning: string;
  extractedCompanyName: string | null;
  extractedPersonNames: string[];
  isRelevantToDeal: boolean; // Whether this activity is sales-related
  excludeReason: string | null; // Reason to exclude (e.g., "newsletter", "automated notification")
  requiresHumanReview: boolean;
  reviewReason: string | null;
}

export interface ActivityForMatching {
  id: string;
  type: 'email_sent' | 'email_received' | 'meeting';
  subject: string;
  body: string;
  occurredAt: string;
  metadata: {
    fromEmail?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    folder?: string;
    location?: string;
    attendees?: string[];
    organizer?: string;
  };
}

interface CompanyForMatching {
  id: string;
  name: string;
  status: string;
  segment: string;
  industry: string;
}

interface DealForMatching {
  id: string;
  name: string;
  stage: string;
  company_id: string;
  company_name: string;
  sales_team: string | null;
}

interface ContactForMatching {
  id: string;
  name: string;
  email: string | null;
  company_id: string;
  company_name: string;
}

/**
 * Use AI to match an activity (email/calendar event) to companies, deals, and contacts
 */
export async function aiMatchActivityToEntities(
  activity: ActivityForMatching,
  userId: string
): Promise<AIActivityMatchResult> {
  const supabase = createAdminClient();

  // Fetch all companies, deals, and contacts for context
  const [companiesResult, dealsResult, contactsResult] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, status, segment, industry')
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('deals')
      .select(`
        id,
        name,
        stage,
        company_id,
        sales_team,
        company:companies(name)
      `)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('contacts')
      .select(`
        id,
        name,
        email,
        company_id,
        company:companies(name)
      `)
      .order('updated_at', { ascending: false })
      .limit(1000),
  ]);

  const companies: CompanyForMatching[] = companiesResult.data || [];
  const deals: DealForMatching[] = (dealsResult.data || []).map((d) => {
    const company = Array.isArray(d.company) ? d.company[0] : d.company;
    return {
      id: d.id,
      name: d.name,
      stage: d.stage,
      company_id: d.company_id,
      company_name: company?.name || 'Unknown',
      sales_team: d.sales_team,
    };
  });
  const contacts: ContactForMatching[] = (contactsResult.data || []).map((c) => {
    const company = Array.isArray(c.company) ? c.company[0] : c.company;
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      company_id: c.company_id,
      company_name: company?.name || 'Unknown',
    };
  });

  // Build company list for the prompt
  const companyList = companies
    .slice(0, 100)
    .map((c) => `- ${c.name} (ID: ${c.id}, Status: ${c.status})`)
    .join('\n');

  // Build deal list for the prompt
  const dealList = deals
    .slice(0, 100)
    .map((d) => `- ${d.name} at ${d.company_name} (ID: ${d.id}, Stage: ${d.stage})`)
    .join('\n');

  // Build contact list with emails for matching
  const contactList = contacts
    .filter(c => c.email)
    .slice(0, 200)
    .map((c) => `- ${c.name} <${c.email}> at ${c.company_name} (ID: ${c.id})`)
    .join('\n');

  // Build activity details
  const activityType = activity.type === 'meeting' ? 'Calendar Event' :
    activity.type === 'email_sent' ? 'Sent Email' : 'Received Email';

  const participants = [
    activity.metadata.fromEmail,
    ...(activity.metadata.to || []),
    ...(activity.metadata.cc || []),
    ...(activity.metadata.attendees || []),
    activity.metadata.organizer,
  ].filter(Boolean).join(', ');

  // Truncate body if too long
  const maxBodyLength = 5000;
  const truncatedBody = activity.body.length > maxBodyLength
    ? activity.body.slice(0, maxBodyLength) + '\n\n[... content truncated ...]'
    : activity.body;

  const prompt = `You are analyzing a ${activityType} to determine:
1. Which company and deal it should be associated with
2. Whether it's relevant to sales/deals (or should be excluded as non-business)

## Activity Details
- Type: ${activityType}
- Subject: ${activity.subject}
- Date: ${activity.occurredAt}
- Participants: ${participants || 'Unknown'}
${activity.metadata.folder ? `- Folder: ${activity.metadata.folder}` : ''}
${activity.metadata.location ? `- Location: ${activity.metadata.location}` : ''}

## Content
${truncatedBody || '(No content)'}

## Known Contacts (with emails)
${contactList || 'No contacts with emails found'}

## Available Companies
${companyList || 'No companies found'}

## Active Deals
${dealList || 'No active deals found'}

---

Analyze this ${activityType.toLowerCase()} and determine:

1. **Is this relevant to a sales deal?**
   - Set isRelevantToDeal=false for: newsletters, marketing emails, automated notifications, spam, personal emails, system notifications, holiday greetings not from prospects
   - Set isRelevantToDeal=true for: customer communications, prospect emails, meeting invites with clients, deal-related correspondence

2. **Match to entities:** If relevant, identify the company, deal, and contact

3. **Review needed?** Set requiresHumanReview=true if:
   - Confidence < 0.6
   - Multiple possible matches
   - Company mentioned but not in CRM
   - Unsure about relevance

Respond with JSON:`;

  const schema = `{
  "companyMatch": {
    "id": "UUID of matched company or null",
    "name": "Company name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this company was matched"]
  } | null,
  "dealMatch": {
    "id": "UUID of matched deal or null",
    "name": "Deal name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this deal was matched"]
  } | null,
  "contactMatch": {
    "id": "UUID of matched contact or null",
    "name": "Contact name",
    "matchScore": 0.0-1.0,
    "matchReasons": ["Why this contact was matched (e.g., email match)"]
  } | null,
  "overallConfidence": 0.0-1.0,
  "reasoning": "Explanation of the matching logic",
  "extractedCompanyName": "Company name if identified but not in CRM, or null",
  "extractedPersonNames": ["Names of people in the activity"],
  "isRelevantToDeal": true/false,
  "excludeReason": "Why this should be excluded (if isRelevantToDeal=false) or null",
  "requiresHumanReview": true/false,
  "reviewReason": "Why human review is needed or null"
}`;

  try {
    const { data, usage, latencyMs } = await callAIJson<AIActivityMatchResult>({
      prompt,
      schema,
      maxTokens: 1500,
    });

    // Log AI usage
    await logAIUsage(supabase, {
      insightType: 'activity_entity_match',
      userId,
      usage,
      latencyMs,
      model: 'claude-sonnet-4-20250514',
      data: {
        activityType: activity.type,
        subject: activity.subject,
        matchedCompanyId: data.companyMatch?.id,
        matchedDealId: data.dealMatch?.id,
        isRelevant: data.isRelevantToDeal,
        confidence: data.overallConfidence,
      },
    });

    // Validate matched IDs exist
    if (data.companyMatch?.id) {
      const validCompany = companies.find((c) => c.id === data.companyMatch?.id);
      if (!validCompany) {
        console.warn('[Activity Match] AI returned invalid company ID:', data.companyMatch.id);
        data.companyMatch = null;
        data.requiresHumanReview = true;
        data.reviewReason = 'AI suggested a company that could not be verified';
      }
    }

    if (data.dealMatch?.id) {
      const validDeal = deals.find((d) => d.id === data.dealMatch?.id);
      if (!validDeal) {
        console.warn('[Activity Match] AI returned invalid deal ID:', data.dealMatch.id);
        data.dealMatch = null;
        data.requiresHumanReview = true;
        data.reviewReason = 'AI suggested a deal that could not be verified';
      }
    }

    if (data.contactMatch?.id) {
      const validContact = contacts.find((c) => c.id === data.contactMatch?.id);
      if (!validContact) {
        console.warn('[Activity Match] AI returned invalid contact ID:', data.contactMatch.id);
        data.contactMatch = null;
      }
    }

    return data;
  } catch (error) {
    console.error('[Activity Match] Error:', error);

    return {
      companyMatch: null,
      dealMatch: null,
      contactMatch: null,
      overallConfidence: 0,
      reasoning: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      extractedCompanyName: null,
      extractedPersonNames: [],
      isRelevantToDeal: true, // Assume relevant if we can't determine
      excludeReason: null,
      requiresHumanReview: true,
      reviewReason: 'AI analysis failed - manual review required',
    };
  }
}

/**
 * Batch match activities using AI with rate limiting
 */
export async function batchMatchActivities(
  activities: ActivityForMatching[],
  userId: string,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<Map<string, AIActivityMatchResult>> {
  const { batchSize = 5, delayBetweenBatches = 1000, onProgress } = options;
  const results = new Map<string, AIActivityMatchResult>();

  for (let i = 0; i < activities.length; i += batchSize) {
    const batch = activities.slice(i, i + batchSize);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(activity =>
        aiMatchActivityToEntities(activity, userId)
          .then(result => ({ activityId: activity.id, result }))
          .catch(error => {
            console.error(`[Batch Match] Error matching activity ${activity.id}:`, error);
            return {
              activityId: activity.id,
              result: {
                companyMatch: null,
                dealMatch: null,
                contactMatch: null,
                overallConfidence: 0,
                reasoning: 'Matching failed',
                extractedCompanyName: null,
                extractedPersonNames: [],
                isRelevantToDeal: true,
                excludeReason: null,
                requiresHumanReview: true,
                reviewReason: 'Matching failed - manual review required',
              } as AIActivityMatchResult,
            };
          })
      )
    );

    // Store results
    for (const { activityId, result } of batchResults) {
      results.set(activityId, result);
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batchSize, activities.length), activities.length);
    }

    // Delay between batches to avoid rate limiting
    if (i + batchSize < activities.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}

/**
 * Create a task for human review of activity assignment
 */
export async function createActivityReviewTask(
  activityId: string,
  activityType: string,
  subject: string,
  aiMatchResult: AIActivityMatchResult,
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const activityTypeLabel = activityType === 'meeting' ? 'Calendar Event' :
    activityType === 'email_sent' ? 'Sent Email' : 'Received Email';

  const descriptionParts = [
    `A ${activityTypeLabel.toLowerCase()} "${subject}" needs manual review to determine assignment.`,
    '',
    '**AI Analysis:**',
    aiMatchResult.reasoning,
  ];

  if (aiMatchResult.extractedCompanyName) {
    descriptionParts.push(`\n**Mentioned Company:** ${aiMatchResult.extractedCompanyName}`);
  }

  if (aiMatchResult.extractedPersonNames.length > 0) {
    descriptionParts.push(`\n**People Identified:** ${aiMatchResult.extractedPersonNames.join(', ')}`);
  }

  if (!aiMatchResult.isRelevantToDeal) {
    descriptionParts.push(`\n**⚠️ Possibly Not Deal-Related:** ${aiMatchResult.excludeReason || 'Unknown reason'}`);
    descriptionParts.push('\nConsider marking as excluded if not relevant to sales.');
  }

  if (aiMatchResult.reviewReason) {
    descriptionParts.push(`\n**Review Reason:** ${aiMatchResult.reviewReason}`);
  }

  descriptionParts.push('');
  descriptionParts.push('═══════════════════════════════════════════');
  descriptionParts.push('✅ ACTION OPTIONS');
  descriptionParts.push('═══════════════════════════════════════════');
  descriptionParts.push('');
  descriptionParts.push('**Option A - Assign to Deal:**');
  descriptionParts.push('  Find the correct company/deal and update the activity');
  descriptionParts.push('');
  descriptionParts.push('**Option B - Exclude:**');
  descriptionParts.push('  Mark as excluded if not relevant to any deal');
  descriptionParts.push('');
  descriptionParts.push(`**Activity ID:** ${activityId}`);
  descriptionParts.push(`**Confidence:** ${(aiMatchResult.overallConfidence * 100).toFixed(0)}%`);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3); // 3 days to review

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      deal_id: aiMatchResult.dealMatch?.id || null,
      company_id: aiMatchResult.companyMatch?.id || null,
      assigned_to: userId,
      created_by: null,
      type: 'review',
      title: `Review ${activityTypeLabel.toLowerCase()}: ${subject.slice(0, 50)}${subject.length > 50 ? '...' : ''}`,
      description: descriptionParts.join('\n'),
      priority: 'medium',
      due_at: dueDate.toISOString(),
      source: 'pst_import',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Activity Review] Failed to create review task:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Quick email-based matching without AI (for basic deduplication and fast matching)
 */
export function quickMatchByEmail(
  activity: ActivityForMatching,
  contacts: Array<{ id: string; email: string | null; company_id: string; name: string }>
): { contactId: string; companyId: string; contactName: string } | null {
  const emailsInActivity = [
    activity.metadata.fromEmail,
    ...(activity.metadata.to || []),
    ...(activity.metadata.cc || []),
    ...(activity.metadata.attendees || []),
    activity.metadata.organizer,
  ].filter(Boolean).map(e => e!.toLowerCase());

  for (const email of emailsInActivity) {
    const matchedContact = contacts.find(c =>
      c.email && c.email.toLowerCase() === email
    );
    if (matchedContact) {
      return {
        contactId: matchedContact.id,
        companyId: matchedContact.company_id,
        contactName: matchedContact.name,
      };
    }
  }

  return null;
}

/**
 * Find the most relevant deal for a company based on activity date
 */
export async function findRelevantDeal(
  companyId: string,
  activityDate: string
): Promise<{ id: string; name: string } | null> {
  const supabase = createAdminClient();

  // Find active deals for this company, preferring ones updated around the activity date
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage, updated_at')
    .eq('company_id', companyId)
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (!deals || deals.length === 0) {
    return null;
  }

  // Return the most recently updated deal
  return { id: deals[0].id, name: deals[0].name };
}
