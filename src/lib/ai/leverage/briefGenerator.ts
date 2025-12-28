/**
 * Brief Generator
 *
 * Generates Human Leverage Briefs - the killer feature.
 * Every brief answers these questions in <60 seconds:
 *
 * 1. Situation - What happened?
 * 2. Why It Matters - Business impact with trust basis
 * 3. What AI Did - What automation already tried
 * 4. What You Should Do - ONE clear action
 * 5. Why This Needs You - Why AI can't do this
 * 6. Talking Points - Specific things to say
 * 7. What to Avoid - Things NOT to say
 * 8. Success Criteria - How to know it worked
 * 9. If Unsuccessful - Fallback plan
 */

import { TriggerResult, TriggerType, TriggerContext } from './triggerDetection';
import { TrustBasis } from './trustBasis';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getAccountMemory,
  getCommunicationGuidance,
  getAvoidList,
  type AccountMemoryContext,
} from '@/lib/ai/memory';

// ============================================
// TYPES
// ============================================

export interface HumanLeverageBrief {
  // Classification
  type: TriggerType;
  urgency: 'immediate' | 'today' | 'this_week' | 'before_next_milestone';
  requiredRole: 'rep' | 'sales_manager' | 'exec' | 'founder';

  // Confidence
  confidence: number;
  confidenceLow: number;
  confidenceHigh: number;
  confidenceLabel: string;

  // Trust basis
  trustBasis: TrustBasis;

  // The Brief Content
  situation: string;
  whyItMatters: string;
  whatAiDid: string;
  whatHumanMustDo: string;
  whyHuman: string;
  talkingPoints: string[];
  dataPoints: Array<{ label: string; value: string }>;
  avoid: string[];
  successCriteria: string;
  ifUnsuccessful: string;
}

// ============================================
// BRIEF TEMPLATES BY TRIGGER TYPE
// ============================================

interface BriefTemplate {
  whyHuman: string;
  successCriteria: string;
  ifUnsuccessful: string;
}

const BRIEF_TEMPLATES: Record<TriggerType, BriefTemplate> = {
  relationship_repair: {
    whyHuman: 'Automated emails have been ignored. A personal call conveys urgency and shows commitment that no email can match. Your voice builds rapport that re-opens doors.',
    successCriteria: 'Prospect responds or schedules a follow-up conversation within 48 hours',
    ifUnsuccessful: 'If no response after call attempt, send a "breakup" email offering to reconnect when timing is better. Move deal to nurture if no engagement within 7 days.',
  },
  exec_intro: {
    whyHuman: 'Executive introductions require human judgment on timing and approach. Your champion relationship and read of the situation determines the right ask. AI cannot gauge relationship dynamics.',
    successCriteria: 'Meeting scheduled with economic buyer within 2 weeks',
    ifUnsuccessful: 'If champion cannot facilitate, explore alternative paths: board connections, industry events, or mutual contacts. Consider involving your sales leadership for peer-to-peer outreach.',
  },
  competitive_threat: {
    whyHuman: 'Competitive battles require real-time adaptation and emotional intelligence. You can read reactions, adjust positioning, and build trust that counters competitor FUD. This is relationship work.',
    successCriteria: 'Prospect confirms they are moving forward with evaluation and competitor is no longer primary option',
    ifUnsuccessful: 'If competitor is preferred, understand specific reasons and either address them or gracefully exit. Document learnings for future competitive situations.',
  },
  pricing_exception: {
    whyHuman: 'Pricing negotiations require judgment on deal value, customer potential, and precedent. You understand the full relationship context and can negotiate creatively beyond just discount.',
    successCriteria: 'Agreement on pricing that works for both parties, with clear path to close within 30 days',
    ifUnsuccessful: 'If price remains a blocker, explore alternative structures: payment terms, scope reduction, pilot pricing, or multi-year commitment. Involve finance if needed.',
  },
};

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

export async function generateBrief(
  trigger: TriggerResult,
  context: TriggerContext,
  trustBasis: TrustBasis
): Promise<HumanLeverageBrief> {
  const supabase = createAdminClient();

  // Get company and contact details
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', context.companyId)
    .single();

  const { data: primaryContact } = await supabase
    .from('contacts')
    .select('name, title')
    .eq('company_id', context.companyId)
    .eq('is_primary', true)
    .single();

  // Get account memory using enhanced utility
  const memory = await getAccountMemory(context.companyId);

  const companyName = company?.name || 'the prospect';
  const contactName = primaryContact?.name || 'the contact';
  const contactTitle = primaryContact?.title || '';

  const template = BRIEF_TEMPLATES[trigger.type];

  // Generate type-specific content
  const briefContent = generateTypeSpecificContent(
    trigger,
    context,
    companyName,
    contactName,
    contactTitle,
    memory
  );

  // Enhance with memory-based guidance
  const memoryAvoid = getAvoidList(memory);
  const commGuidance = getCommunicationGuidance(memory);

  // Build confidence label
  const confidenceLabel = `${trigger.confidence}% confidence (${trigger.confidenceLow}-${trigger.confidenceHigh}% range)`;

  return {
    type: trigger.type,
    urgency: trigger.urgency,
    requiredRole: trigger.requiredRole,
    confidence: trigger.confidence,
    confidenceLow: trigger.confidenceLow,
    confidenceHigh: trigger.confidenceHigh,
    confidenceLabel,
    trustBasis,
    situation: briefContent.situation,
    whyItMatters: briefContent.whyItMatters,
    whatAiDid: briefContent.whatAiDid,
    whatHumanMustDo: enhanceWithCommGuidance(briefContent.whatHumanMustDo, commGuidance),
    whyHuman: template.whyHuman,
    talkingPoints: briefContent.talkingPoints,
    dataPoints: trustBasis.dataPoints,
    avoid: [...briefContent.avoid, ...memoryAvoid],
    successCriteria: template.successCriteria,
    ifUnsuccessful: template.ifUnsuccessful,
  };
}

function enhanceWithCommGuidance(action: string, guidance: string[]): string {
  if (guidance.length === 0) return action;
  return `${action}\n\nCommunication tips: ${guidance.join('. ')}.`;
}

// ============================================
// TYPE-SPECIFIC CONTENT GENERATION
// ============================================

interface BriefContent {
  situation: string;
  whyItMatters: string;
  whatAiDid: string;
  whatHumanMustDo: string;
  talkingPoints: string[];
  avoid: string[];
}

function generateTypeSpecificContent(
  trigger: TriggerResult,
  context: TriggerContext,
  companyName: string,
  contactName: string,
  contactTitle: string,
  memory: AccountMemoryContext
): BriefContent {
  switch (trigger.type) {
    case 'relationship_repair':
      return generateRelationshipRepairContent(trigger, context, companyName, contactName, contactTitle, memory);
    case 'exec_intro':
      return generateExecIntroContent(trigger, context, companyName, contactName, contactTitle, memory);
    case 'competitive_threat':
      return generateCompetitiveThreatContent(trigger, context, companyName, contactName, memory);
    case 'pricing_exception':
      return generatePricingExceptionContent(trigger, context, companyName, contactName, memory);
    default:
      return generateGenericContent(trigger, context, companyName);
  }
}

function generateRelationshipRepairContent(
  trigger: TriggerResult,
  context: TriggerContext,
  companyName: string,
  contactName: string,
  contactTitle: string,
  memory: AccountMemoryContext
): BriefContent {
  const daysSinceInbound = trigger.dataPoints.daysSinceInbound as number;
  const outboundCount = trigger.dataPoints.outboundCount as number;

  // Build rapport-based talking points using memory
  const rapportBuilders = memory.rapportBuilders;
  const resonates = memory.resonates;

  let talkingPoints = [
    `"${contactName}, I wanted to reach out directly because I haven't heard back and wanted to make sure nothing fell through the cracks"`,
    '"Is this still a priority for you and the team?"',
    '"What would need to change for this to make sense for you?"',
    '"I\'d rather know if timing isn\'t right than keep reaching out"',
  ];

  // Add rapport-based point if available
  if (rapportBuilders.length > 0) {
    talkingPoints.unshift(`Reference: ${rapportBuilders[0]} (builds personal connection)`);
  }

  // Add resonance-based point
  if (resonates.length > 0) {
    talkingPoints.push(`Emphasize: ${resonates[0]} (this resonated before)`);
  }

  return {
    situation: `${companyName} has gone silent. No inbound response in ${daysSinceInbound} days despite ${outboundCount} outreach attempts. Deal momentum is ${context.intelligence.momentum}.`,
    whyItMatters: `This deal represents $${context.intelligence.estimated_acv.toLocaleString()} potential ACV with ${context.intelligence.win_probability}% win probability. Every week of delay costs $${context.intelligence.cost_of_delay_per_week.toLocaleString()}. ${trigger.dataPoints.momentum === 'dead' ? 'Deal is at risk of being lost entirely.' : 'Early intervention prevents deals from going cold.'}`,
    whatAiDid: `Sent ${outboundCount} automated follow-up emails over the past ${daysSinceInbound} days. Monitored for any response or engagement signals. None detected.`,
    whatHumanMustDo: `Call ${contactName}${contactTitle ? ` (${contactTitle})` : ''} directly. Voice communication breaks through when email fails.`,
    talkingPoints,
    avoid: [
      'Don\'t apologize for following up - you\'re doing your job',
      'Avoid asking "did you get my email?" - sounds passive',
      'Don\'t mention competitors or create pressure',
    ],
  };
}

function generateExecIntroContent(
  trigger: TriggerResult,
  context: TriggerContext,
  companyName: string,
  contactName: string,
  contactTitle: string,
  memory: AccountMemoryContext
): BriefContent {
  const authorityConfidence = trigger.dataPoints.authorityConfidence as number;
  const championConfidence = trigger.dataPoints.championConfidence as number;
  const hasChampion = championConfidence >= 50;

  return {
    situation: `${companyName} deal is in ${context.deal.stage} stage but we have no access to the economic buyer. Authority confidence is only ${authorityConfidence}%.${hasChampion ? ` We have a champion (${championConfidence}% confidence) who can facilitate an introduction.` : ' No strong champion identified yet.'}`,
    whyItMatters: `Deals without decision-maker access by ${context.deal.stage} stage have significantly lower win rates. This $${context.intelligence.estimated_acv.toLocaleString()} opportunity needs executive alignment before advancing to close.`,
    whatAiDid: `Analyzed contact hierarchy and engagement patterns. Identified gap in executive access. ${hasChampion ? 'Champion relationship appears strong enough to ask for help.' : 'No clear path to executive identified through existing contacts.'}`,
    whatHumanMustDo: hasChampion
      ? `Ask ${contactName} to introduce you to their leadership. Frame it as helping them build internal support for the project.`
      : `Identify the decision maker through research and request a direct introduction. Consider involving your sales leadership for peer-to-peer outreach.`,
    talkingPoints: hasChampion
      ? [
          `"${contactName}, you've been great to work with. To make sure this gets the support it needs internally, who else should be involved in the conversation?"`,
          '"I want to make sure we\'re addressing any concerns leadership might have"',
          '"Would it help if I prepared materials specifically for the executive conversation?"',
          '"What matters most to your leadership when evaluating investments like this?"',
        ]
      : [
          '"Who ultimately signs off on decisions like this?"',
          '"What does your approval process typically look like?"',
          '"I\'d like to make sure we\'re aligned with leadership priorities"',
          '"Would it make sense to include your [VP/Director/Owner] in our next conversation?"',
        ],
    avoid: [
      'Don\'t imply the current contact can\'t make decisions',
      'Avoid "going over their head" framing',
      'Don\'t create urgency that feels artificial',
      'Avoid making the champion feel bypassed',
    ],
  };
}

function generateCompetitiveThreatContent(
  trigger: TriggerResult,
  context: TriggerContext,
  companyName: string,
  contactName: string,
  memory: AccountMemoryContext
): BriefContent {
  const competitor = trigger.dataPoints.competitor as string;

  return {
    situation: `${companyName} is evaluating ${competitor} alongside our solution. Deal is in ${context.deal.stage} stage with ${context.intelligence.win_probability}% win probability.`,
    whyItMatters: `Competitive deals that aren't addressed directly have lower win rates. The $${context.intelligence.estimated_acv.toLocaleString()} opportunity is at risk if we don't differentiate effectively. ${context.intelligence.momentum === 'stalling' ? 'Deal momentum is already stalling, suggesting competitor may be gaining ground.' : ''}`,
    whatAiDid: `Detected competitor mention in communications. Monitoring for evaluation signals and timeline indicators.`,
    whatHumanMustDo: `Schedule a competitive positioning conversation with ${contactName}. Address ${competitor} comparison directly and reinforce unique value.`,
    talkingPoints: [
      `"I noticed you're also looking at ${competitor}. What are the key criteria you're using to evaluate?"`,
      '"What would make this decision easy for you?"',
      '"Here\'s where we typically see the biggest difference in outcomes..."',
      '"I\'d rather you have accurate information about both options"',
      '"What concerns do you have about going with us vs them?"',
    ],
    avoid: [
      `Don't trash talk ${competitor} - it looks defensive`,
      'Avoid feature-by-feature comparisons unless asked',
      'Don\'t create FUD (fear, uncertainty, doubt) - it backfires',
      'Avoid price as the differentiator unless it\'s truly better',
    ],
  };
}

function generatePricingExceptionContent(
  trigger: TriggerResult,
  context: TriggerContext,
  companyName: string,
  contactName: string,
  memory: AccountMemoryContext
): BriefContent {
  const acv = trigger.dataPoints.estimatedAcv as number;

  return {
    situation: `${companyName} has raised price concerns on a $${acv.toLocaleString()} ACV opportunity. Current momentum is ${context.intelligence.momentum} with ${context.intelligence.win_probability}% win probability.`,
    whyItMatters: `High-value deals with price objections often close with creative structuring. This opportunity is worth significant effort to save. Expected value is $${context.intelligence.expected_value.toLocaleString()}.`,
    whatAiDid: `Identified price-related objections in recent communications. Analyzed deal value and customer potential to flag for human pricing discussion.`,
    whatHumanMustDo: `Have a direct conversation about pricing with ${contactName}. Understand the real constraint (budget timing? budget amount? perceived value?) and explore creative solutions.`,
    talkingPoints: [
      '"Help me understand the budget constraint - is it timing, total amount, or something else?"',
      '"If price weren\'t a factor, would this be the right solution for you?"',
      '"Let me see what flexibility we might have given the potential of this partnership"',
      '"Would different payment terms help? Annual vs monthly, phased rollout?"',
      '"What if we started with a smaller scope and expanded as you see results?"',
    ],
    avoid: [
      'Don\'t immediately offer a discount - understand the real issue first',
      'Avoid making promises you can\'t keep',
      'Don\'t undervalue the product - it sets bad precedent',
      'Avoid one-sided concessions - get something in return',
    ],
  };
}

function generateGenericContent(
  trigger: TriggerResult,
  context: TriggerContext,
  companyName: string
): BriefContent {
  return {
    situation: `${companyName} deal requires human intervention. ${trigger.signalSources.join('. ')}.`,
    whyItMatters: `This $${context.intelligence.estimated_acv.toLocaleString()} opportunity has ${context.intelligence.win_probability}% win probability. Action is needed to maintain momentum.`,
    whatAiDid: `Detected signals requiring human judgment. Automated actions have been exhausted.`,
    whatHumanMustDo: `Review the situation and take appropriate action based on your relationship and context.`,
    talkingPoints: [
      'Acknowledge the current situation',
      'Understand their perspective',
      'Propose a path forward',
      'Confirm next steps',
    ],
    avoid: [
      'Don\'t assume - ask questions',
      'Avoid creating unnecessary pressure',
      'Don\'t make commitments without authority',
    ],
  };
}
