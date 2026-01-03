/**
 * AI Email Generation for Scheduling
 *
 * Generates professional, contextual scheduling emails using Claude AI.
 * Supports initial outreach, follow-ups, confirmations, reminders, and no-show handling.
 */

import { callAIJson } from '@/lib/ai/core/aiClient';
import { getPrompt, getPromptWithVariables } from '@/lib/ai/promptManager';
import {
  SchedulingEmailContext,
  GeneratedEmail,
  MeetingType,
  ProposedTimeSlot,
  SchedulingRequest,
  SchedulingAttendee,
  ConversationMessage,
  MEETING_TYPES,
} from './types';
import {
  TaggedTimestamp,
  AIExtractedTime,
  createTaggedTimestamp,
  formatTaggedForEmail,
  isValidTimezone,
  logTaggedTimestamp,
} from './taggedTimestamp';
import {
  validateProposedTime,
  logTimestampConversion,
} from './timestampValidator';

// ============================================
// EMAIL TYPE DEFINITIONS
// ============================================

export type EmailType =
  | 'initial_outreach'
  | 'follow_up'
  | 'second_follow_up'
  | 'confirmation'
  | 'reminder'
  | 'no_show'
  | 'reschedule';

interface EmailGenerationInput {
  emailType: EmailType;
  request: SchedulingRequest;
  attendees: SchedulingAttendee[];
  proposedTimes?: ProposedTimeSlot[];
  senderName: string;
  senderTitle?: string;
  companyContext?: {
    name: string;
    industry?: string;
    recentActivity?: string;
  };
  dealContext?: {
    stage?: string;
    lastMeeting?: string;
    keyPoints?: string[];
    nextSteps?: string[];
  };
  conversationHistory?: ConversationMessage[];
}

// ============================================
// EMAIL GENERATION SERVICE
// ============================================

/**
 * Generates a scheduling email using AI
 */
export async function generateSchedulingEmail(
  input: EmailGenerationInput
): Promise<{ email: GeneratedEmail; reasoning: string }> {
  const prompt = buildEmailPrompt(input);
  const promptConfig = await getSchedulerEmailSystemPrompt();

  const response = await callAIJson<{
    subject: string;
    body: string;
    reasoning: string;
  }>({
    prompt,
    systemPrompt: promptConfig.prompt,
    model: promptConfig.model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307' | 'claude-opus-4-20250514' | undefined,
    maxTokens: promptConfig.maxTokens || 2000,
    schema: `{
      "subject": "Email subject line (concise, professional)",
      "body": "Full email body with proper formatting",
      "reasoning": "Brief explanation of approach taken"
    }`,
    temperature: 0.7,
  });

  return {
    email: {
      subject: response.data.subject,
      body: response.data.body,
    },
    reasoning: response.data.reasoning,
  };
}

/**
 * Generates multiple email variants for A/B testing or user selection
 */
export async function generateEmailVariants(
  input: EmailGenerationInput,
  count: number = 3
): Promise<GeneratedEmail[]> {
  const prompt = buildEmailPrompt(input, true, count);
  const promptConfig = await getSchedulerEmailSystemPrompt();

  const response = await callAIJson<{
    variants: Array<{ subject: string; body: string }>;
  }>({
    prompt,
    systemPrompt: promptConfig.prompt,
    model: promptConfig.model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307' | 'claude-opus-4-20250514' | undefined,
    schema: `{
      "variants": [
        { "subject": "...", "body": "..." },
        // ${count} variants total
      ]
    }`,
    maxTokens: 3000,
    temperature: 0.8,
  });

  return response.data.variants;
}

// ============================================
// PROMPT MANAGEMENT
// ============================================

// Default fallback prompt (used if database prompt not available)
const DEFAULT_SCHEDULING_EMAIL_SYSTEM_PROMPT = `You are an expert B2B sales email writer specializing in meeting scheduling.

Your emails are:
- Professional yet warm and approachable
- Concise but complete (respect recipient's time)
- Focused on value, not just logistics
- Natural sounding (not robotic or template-ish)

Industry context:
- Recipients are pest control and lawn care business owners/managers
- They're busy running operations and taking customer calls
- They value directness and practical outcomes
- Avoid corporate jargon; be authentic

Email structure best practices:
- Subject: Clear, specific, creates curiosity (max 50 chars)
- Opening: Personal connection or context (1-2 sentences)
- Body: Clear purpose and value proposition
- Times: Present cleanly with timezone noted
- Close: Single clear call to action
- Signature: Professional but brief

IMPORTANT: Generate actual email content, not placeholders. Use the provided context to personalize.`;

/**
 * Get the scheduling email system prompt from database with fallback
 */
async function getSchedulerEmailSystemPrompt(): Promise<{ prompt: string; model: string; maxTokens: number }> {
  try {
    const dbPrompt = await getPrompt('scheduler_email_system');
    if (dbPrompt) {
      return {
        prompt: dbPrompt.prompt_template,
        model: dbPrompt.model || 'claude-sonnet-4-20250514',
        maxTokens: dbPrompt.max_tokens || 2000,
      };
    }
  } catch (error) {
    console.warn('[EmailGeneration] Failed to load prompt from database, using default:', error);
  }

  return {
    prompt: DEFAULT_SCHEDULING_EMAIL_SYSTEM_PROMPT,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2000,
  };
}

// ============================================
// PROMPT BUILDERS
// ============================================

function buildEmailPrompt(
  input: EmailGenerationInput,
  generateVariants: boolean = false,
  variantCount: number = 3
): string {
  const {
    emailType,
    request,
    attendees,
    proposedTimes,
    senderName,
    senderTitle,
    companyContext,
    dealContext,
    conversationHistory,
  } = input;

  const primaryContact = attendees.find((a) => a.is_primary_contact) || attendees[0];
  const externalAttendees = attendees.filter((a) => a.side === 'external');
  const internalAttendees = attendees.filter((a) => a.side === 'internal');

  // Build context sections
  const sections: string[] = [];

  // 1. Task description
  sections.push(`## Task
Generate ${generateVariants ? `${variantCount} variants of ` : ''}a ${emailType.replace(/_/g, ' ')} email for scheduling a ${getMeetingTypeLabel(request.meeting_type)}.`);

  // 2. Recipient info
  sections.push(`## Recipient
- Name: ${primaryContact?.name || 'Unknown'}
- Title: ${primaryContact?.title || 'Not specified'}
- Email: ${primaryContact?.email || 'Unknown'}
${externalAttendees.length > 1 ? `- Other attendees: ${externalAttendees.slice(1).map((a) => a.name).join(', ')}` : ''}`);

  // 3. Company context
  if (companyContext) {
    sections.push(`## Company Context
- Company: ${companyContext.name}
${companyContext.industry ? `- Industry: ${companyContext.industry}` : ''}
${companyContext.recentActivity ? `- Recent: ${companyContext.recentActivity}` : ''}`);
  }

  // 4. Meeting details
  sections.push(`## Meeting Details
- Type: ${getMeetingTypeLabel(request.meeting_type)}
- Duration: ${request.duration_minutes} minutes
- Platform: ${request.meeting_platform}
${request.context ? `- Context: ${request.context}` : ''}
${request.title ? `- Title: ${request.title}` : ''}`);

  // 5. Deal context if available
  if (dealContext) {
    sections.push(`## Deal Context
${dealContext.stage ? `- Stage: ${dealContext.stage}` : ''}
${dealContext.lastMeeting ? `- Last Meeting: ${dealContext.lastMeeting}` : ''}
${dealContext.keyPoints?.length ? `- Key Points:\n  ${dealContext.keyPoints.map((p) => `- ${p}`).join('\n  ')}` : ''}
${dealContext.nextSteps?.length ? `- Next Steps:\n  ${dealContext.nextSteps.map((s) => `- ${s}`).join('\n  ')}` : ''}`);
  }

  // 6. Proposed times if applicable
  if (proposedTimes && proposedTimes.length > 0) {
    // Include today's date so AI knows what "this week" vs "next week" means
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayFormatted = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York',
    });

    sections.push(`## Proposed Times

⚠️ IMPORTANT - TODAY IS: ${todayFormatted}
⚠️ THE CURRENT YEAR IS: ${currentYear}
⚠️ If writing a seasonal greeting, use "${currentYear}" (e.g., "end of ${currentYear}" or "hope ${currentYear} is treating you well")

Use these EXACT times in the email (copy them verbatim as bullet points):
${proposedTimes.map((t) => `• ${t.formatted}`).join('\n')}

These are pre-formatted and verified. Copy them exactly as shown above.`);
  }

  // 7. Conversation history for context
  if (conversationHistory && conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-3);
    sections.push(`## Recent Conversation
${recentMessages.map((m) => `[${m.direction}] ${m.subject}: ${m.body.slice(0, 200)}...`).join('\n')}`);
  }

  // 8. Sender info
  sections.push(`## Sender
- Name: ${senderName}
${senderTitle ? `- Title: ${senderTitle}` : ''}`);

  // 9. Email type specific instructions
  sections.push(getEmailTypeInstructions(emailType, request));

  // 10. Our team
  if (internalAttendees.length > 0) {
    sections.push(`## Our Team in Meeting
${internalAttendees.map((a) => `- ${a.name || 'Team member'}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

function getMeetingTypeLabel(type: MeetingType): string {
  const labels: Record<MeetingType, string> = {
    [MEETING_TYPES.DISCOVERY]: 'Discovery Call',
    [MEETING_TYPES.DEMO]: 'Product Demo',
    [MEETING_TYPES.FOLLOW_UP]: 'Follow-up Call',
    [MEETING_TYPES.TECHNICAL]: 'Technical Discussion',
    [MEETING_TYPES.TECHNICAL_DEEP_DIVE]: 'Technical Deep Dive',
    [MEETING_TYPES.EXECUTIVE]: 'Executive Briefing',
    [MEETING_TYPES.EXECUTIVE_BRIEFING]: 'Executive Briefing',
    [MEETING_TYPES.PRICING_NEGOTIATION]: 'Pricing Discussion',
    [MEETING_TYPES.IMPLEMENTATION_PLANNING]: 'Implementation Planning',
    [MEETING_TYPES.CHECK_IN]: 'Check-in Call',
    [MEETING_TYPES.TRIAL_KICKOFF]: 'Trial Kickoff',
    [MEETING_TYPES.CUSTOM]: 'Meeting',
  };
  return labels[type] || 'Meeting';
}

function getEmailTypeInstructions(emailType: EmailType, request: SchedulingRequest): string {
  const instructions: Record<EmailType, string> = {
    initial_outreach: `## Instructions
This is the FIRST outreach to schedule this meeting. Goals:
- Establish rapport and context for the meeting
- Clearly state the purpose and value they'll get
- Present proposed times in a clean, easy-to-select format
- Make it easy to reply with their preference or suggest alternatives
- Keep it concise - they're busy

Tone: Professional, friendly, focused on their benefit`,

    follow_up: `## Instructions
This is a follow-up because we haven't heard back. Goals:
- Gently remind them about the scheduling request
- Don't be pushy or guilt-tripping
- Offer to adjust times if the original ones don't work
- Restate the value briefly
- Make it easy to respond

Tone: Understanding, patient, still professional

Note: This is follow-up attempt #${request.attempt_count}`,

    second_follow_up: `## Instructions
This is a SECOND follow-up - be extra gentle. Goals:
- Acknowledge they're busy
- Keep it very brief
- Offer to reschedule for a better time
- Leave the door open without pressure

Tone: Understanding, no pressure, brief

Note: This is follow-up attempt #${request.attempt_count}`,

    confirmation: `## Instructions
They've selected a time! Send confirmation. Goals:
- Confirm the exact date, time, and timezone
- Include meeting link/location if applicable
- Briefly recap what will be covered
- Express genuine enthusiasm
- Note any prep materials if relevant

Tone: Warm, excited, organized`,

    reminder: `## Instructions
Send a meeting reminder (meeting is coming up soon). Goals:
- Remind them of the meeting time
- Include meeting link prominently
- Brief recap of agenda/purpose
- Ask if they need to reschedule (it happens)
- Keep it short

Tone: Helpful, excited to meet`,

    no_show: `## Instructions
They didn't show up for the meeting. Goals:
- Don't make them feel guilty
- Assume something came up
- Offer to easily reschedule
- Present new time options
- Keep door wide open

Tone: Understanding, no judgment, helpful

Note: No-show count: ${request.no_show_count}`,

    reschedule: `## Instructions
The meeting needs to be rescheduled. Goals:
- Acknowledge the change
- Present new time options
- Make rescheduling feel easy
- Keep positive momentum

Tone: Flexible, accommodating, positive`,
  };

  return instructions[emailType] || '';
}

// ============================================
// TIME SLOT FORMATTING
// ============================================

/**
 * Formats proposed time slots for email display
 */
export function formatTimeSlotsForEmail(
  times: Date[],
  timezone: string = 'America/New_York'
): ProposedTimeSlot[] {
  return times.map((time) => {
    const formatted = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(time);

    const endTime = new Date(time);
    endTime.setMinutes(endTime.getMinutes() + 30); // Default duration

    return {
      start: time,
      end: endTime,
      formatted,
    };
  });
}

/**
 * Generates available time slots based on preferences
 *
 * IMPORTANT: All slots are guaranteed to be at least 2 hours in the future.
 * By default, starts from tomorrow to avoid proposing same-day times.
 */
export function generateProposedTimes(
  dateRangeStart: Date,
  dateRangeEnd: Date,
  preferences: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  },
  avoidDays: string[] = [],
  count: number = 4
): Date[] {
  const slots: Date[] = [];

  // IMPORTANT: Always start from at least tomorrow to avoid proposing past times
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Use the later of dateRangeStart or tomorrow
  const effectiveStart = dateRangeStart > tomorrow ? dateRangeStart : tomorrow;
  const current = new Date(effectiveStart);

  // Minimum 2 hours in the future for any slot
  const minimumSlotTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  while (current <= dateRangeEnd && slots.length < count) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Skip avoided days
    if (avoidDays.includes(dayName) || avoidDays.includes(dayName.slice(0, 3))) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Skip weekends
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Add slots for each preferred time period (only if in the future)
    if (preferences.morning && slots.length < count) {
      const slot = new Date(current);
      slot.setHours(10, 0, 0, 0);
      if (slot > minimumSlotTime) {
        slots.push(slot);
      }
    }
    if (preferences.afternoon && slots.length < count) {
      const slot = new Date(current);
      slot.setHours(14, 0, 0, 0);
      if (slot > minimumSlotTime) {
        slots.push(slot);
      }
    }
    if (preferences.evening && slots.length < count) {
      const slot = new Date(current);
      slot.setHours(17, 30, 0, 0);
      if (slot > minimumSlotTime) {
        slots.push(slot);
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return slots.slice(0, count);
}

// ============================================
// EMAIL PARSING
// ============================================

/**
 * Response from AI parsing with tagged timestamps
 */
export interface ParsedSchedulingResponse {
  intent: 'accept' | 'decline' | 'counter_propose' | 'question' | 'unclear';
  selectedTime?: TaggedTimestamp;
  selectedTimeRaw?: AIExtractedTime;
  counterProposedTimes?: TaggedTimestamp[];
  counterProposedTimesRaw?: AIExtractedTime[];
  question?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  reasoning: string;
  isConfused?: boolean;
  confusionReason?: string;
  validationErrors?: string[];
}

/**
 * Parses an incoming email to detect scheduling intent
 *
 * @deprecated This function is DEPRECATED as of January 2026.
 * Response parsing has been unified into responseProcessor.ts using
 * the managed prompt 'scheduler_response_parsing' which combines
 * intent detection + time extraction in a single optimized AI call.
 *
 * New code should use:
 * - responseProcessor.ts: analyzeSchedulingResponse()
 * - Managed prompt key: 'scheduler_response_parsing'
 *
 * This function will be removed in a future version.
 *
 * IMPORTANT: This function now returns TaggedTimestamps to prevent timezone bugs.
 * The AI is instructed to return LOCAL times in the prospect's timezone, and we
 * convert them properly to avoid the "2pm becomes 6am" bug.
 *
 * @param emailBody - The email content to parse
 * @param proposedTimes - The times we originally proposed (for reference)
 * @param prospectTimezone - The prospect's timezone (critical for correct conversion)
 */
export async function parseSchedulingResponse(
  emailBody: string,
  proposedTimes: string[],
  prospectTimezone: string = 'America/New_York'
): Promise<ParsedSchedulingResponse> {
  // Validate timezone
  if (!isValidTimezone(prospectTimezone)) {
    console.warn(`[parseSchedulingResponse] Invalid timezone "${prospectTimezone}", defaulting to America/New_York`);
    prospectTimezone = 'America/New_York';
  }

  // Build date context for year awareness
  const today = new Date();
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;
  const currentMonth = today.getMonth() + 1;
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: prospectTimezone,
  });

  // Year guidance for when we're in late year
  let yearGuidance = '';
  if (currentMonth === 12) {
    yearGuidance = `
CRITICAL DATE RULES (Today is ${todayFormatted}):
- We are in DECEMBER ${currentYear}. Any mention of January, February, or March means ${nextYear}.
- When someone says "Monday the 5th" or similar, find the future date where the 5th falls on (or near) that day
- January 5, ${nextYear} is a Monday - so "Monday the 5th" = ${nextYear}-01-05
- NEVER return dates in ${currentYear} for January/February/March - those months have already passed
- All timestamps must be in the FUTURE`;
  } else if (currentMonth >= 10) {
    yearGuidance = `Note: Today is ${todayFormatted}. If they mention January/February/March, use ${nextYear}.`;
  }

  const prompt = `Analyze this email response to a meeting scheduling request.

TODAY'S DATE: ${todayFormatted}
PROSPECT'S TIMEZONE: ${prospectTimezone}
${yearGuidance}

## Proposed Times
${proposedTimes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Email Response
${emailBody}

## Task - TIMEZONE CRITICAL
When extracting times from the email, return them as the prospect STATED them - in their LOCAL timezone.
DO NOT convert to UTC. The system will handle timezone conversion.

Example: If prospect says "let's do 2pm on Monday" and they're in ${prospectTimezone}:
- Return localDateTime: "${nextYear}-01-06T14:00:00" (2pm as they said it)
- Return timezone: "${prospectTimezone}"
- DO NOT return "14:00:00Z" - that would be wrong!

Determine:
1. Intent: Are they accepting a time, declining, proposing alternatives, asking a question, or unclear?
2. If accepting: Which specific time did they select? Return as a LOCAL time in their timezone.
3. If counter-proposing: What times are they suggesting? Return as LOCAL times.
4. If questioning: What is their question?
5. Overall sentiment toward the meeting
6. CRITICAL - Confusion Detection: Is the person expressing confusion, frustration, or correcting a mistake?`;

  const response = await callAIJson<{
    intent: 'accept' | 'decline' | 'counter_propose' | 'question' | 'unclear';
    selectedTime?: {
      localDateTime: string;
      timezone: string;
      displayText: string;
    };
    counterProposedTimes?: Array<{
      localDateTime: string;
      timezone: string;
      displayText: string;
    }>;
    question?: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    reasoning: string;
    isConfused?: boolean;
    confusionReason?: string;
  }>({
    prompt,
    systemPrompt: `You are an expert at understanding email intent, especially for scheduling contexts.

CRITICAL TIMEZONE RULES:
1. Extract times AS THE PERSON STATED THEM - in their local timezone
2. NEVER convert to UTC - return the local time they mentioned
3. If they say "2pm", return 14:00:00 in their timezone, NOT in UTC
4. Always include the timezone in your response

Return times in this exact JSON format:
{
  "localDateTime": "2025-01-06T14:00:00",  // The time as they said it
  "timezone": "America/New_York",           // Their timezone
  "displayText": "Monday, January 6 at 2:00 PM ET"
}

PAY SPECIAL ATTENTION to signs of confusion or frustration - if the person seems to be correcting a mistake or expressing that they were misunderstood, set isConfused to true.`,
    schema: `{
      "intent": "accept|decline|counter_propose|question|unclear",
      "selectedTime": {
        "localDateTime": "ISO timestamp in LOCAL time (no Z suffix)",
        "timezone": "IANA timezone like America/New_York",
        "displayText": "Human readable like 'Monday, January 6 at 2:00 PM ET'"
      },
      "counterProposedTimes": [{
        "localDateTime": "ISO timestamp in LOCAL time",
        "timezone": "IANA timezone",
        "displayText": "Human readable"
      }],
      "question": "Their question if asking one",
      "sentiment": "positive|neutral|negative",
      "reasoning": "Brief explanation of your analysis",
      "isConfused": "true if expressing confusion or correcting a mistake",
      "confusionReason": "What they seem confused about"
    }`,
    maxTokens: 1000,
    temperature: 0.3,
  });

  // Convert AI response to tagged timestamps
  const result: ParsedSchedulingResponse = {
    intent: response.data.intent,
    sentiment: response.data.sentiment,
    reasoning: response.data.reasoning,
    question: response.data.question,
    isConfused: response.data.isConfused,
    confusionReason: response.data.confusionReason,
    validationErrors: [],
  };

  // Process selected time
  if (response.data.selectedTime) {
    result.selectedTimeRaw = response.data.selectedTime;

    try {
      const tagged = createTaggedTimestamp(
        response.data.selectedTime.localDateTime,
        response.data.selectedTime.timezone || prospectTimezone
      );

      // Validate the tagged timestamp
      const validation = validateProposedTime(tagged, {
        userTimezone: prospectTimezone,
        businessHoursStart: 7,
        businessHoursEnd: 19,
        minHoursInFuture: 1,
      });

      if (validation.valid) {
        result.selectedTime = tagged;
        logTimestampConversion('Parsed selected time', response.data.selectedTime, tagged);
      } else {
        console.warn('[parseSchedulingResponse] Selected time validation failed:', validation.error);
        result.validationErrors!.push(`Selected time: ${validation.error}`);
      }
    } catch (error) {
      console.error('[parseSchedulingResponse] Failed to create tagged timestamp:', error);
      result.validationErrors!.push(`Failed to parse selected time: ${error}`);
    }
  }

  // Process counter-proposed times
  if (response.data.counterProposedTimes && response.data.counterProposedTimes.length > 0) {
    result.counterProposedTimesRaw = response.data.counterProposedTimes;
    result.counterProposedTimes = [];

    for (const time of response.data.counterProposedTimes) {
      try {
        const tagged = createTaggedTimestamp(
          time.localDateTime,
          time.timezone || prospectTimezone
        );

        const validation = validateProposedTime(tagged, {
          userTimezone: prospectTimezone,
          businessHoursStart: 7,
          businessHoursEnd: 19,
          minHoursInFuture: 1,
        });

        if (validation.valid) {
          result.counterProposedTimes.push(tagged);
          logTimestampConversion('Parsed counter-proposal', time, tagged);
        } else {
          console.warn('[parseSchedulingResponse] Counter-proposal validation failed:', validation.error);
          result.validationErrors!.push(`Counter-proposal: ${validation.error}`);
        }
      } catch (error) {
        console.error('[parseSchedulingResponse] Failed to create tagged timestamp for counter-proposal:', error);
      }
    }
  }

  return result;
}

/**
 * Legacy wrapper for parseSchedulingResponse that returns the old format
 * Use this during migration, but prefer the new format for new code
 * @deprecated Use parseSchedulingResponse directly for tagged timestamps
 */
export async function parseSchedulingResponseLegacy(
  emailBody: string,
  proposedTimes: string[]
): Promise<{
  intent: 'accept' | 'decline' | 'counter_propose' | 'question' | 'unclear';
  selectedTime?: string;
  counterProposedTimes?: string[];
  question?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  reasoning: string;
  isConfused?: boolean;
  confusionReason?: string;
}> {
  const result = await parseSchedulingResponse(emailBody, proposedTimes, 'America/New_York');

  return {
    intent: result.intent,
    selectedTime: result.selectedTime?.utc,
    counterProposedTimes: result.counterProposedTimes?.map(t => t.utc),
    question: result.question,
    sentiment: result.sentiment,
    reasoning: result.reasoning,
    isConfused: result.isConfused,
    confusionReason: result.confusionReason,
  };
}

// ============================================
// MEETING PREP BRIEF GENERATION
// ============================================

/**
 * Generates a meeting prep brief
 */
export async function generateMeetingPrepBrief(input: {
  meetingType: MeetingType;
  companyName: string;
  attendees: Array<{ name: string; title?: string; notes?: string }>;
  dealContext?: {
    stage: string;
    history: string;
    keyPoints: string[];
    objections: string[];
  };
  companyContext?: {
    industry: string;
    size: string;
    recentNews?: string;
  };
  previousMeetings?: Array<{
    date: string;
    summary: string;
    outcomes: string[];
  }>;
}): Promise<{
  executive_summary: string;
  meeting_objective: string;
  key_talking_points: string[];
  questions_to_ask: string[];
  landmines_to_avoid: string[];
  objection_prep: Array<{ objection: string; response: string }>;
  next_steps_to_propose: string[];
  attendee_insights: Array<{ name: string; title?: string; notes: string }>;
}> {
  // Format attendees for the prompt
  const attendeesList = input.attendees.map((a) =>
    `- ${a.name}${a.title ? ` (${a.title})` : ''}${a.notes ? `: ${a.notes}` : ''}`
  ).join('\n');

  // Format deal context
  const dealContextText = input.dealContext
    ? `Stage: ${input.dealContext.stage}, History: ${input.dealContext.history}, Key Points: ${input.dealContext.keyPoints.join(', ')}, Known Objections: ${input.dealContext.objections.join(', ')}`
    : 'No deal context';

  // Format company context
  const companyContextText = input.companyContext
    ? `Industry: ${input.companyContext.industry}, Size: ${input.companyContext.size}${input.companyContext.recentNews ? `, Recent News: ${input.companyContext.recentNews}` : ''}`
    : 'No company context';

  // Format previous meetings
  const previousMeetingsText = input.previousMeetings && input.previousMeetings.length > 0
    ? input.previousMeetings.map((m) => `${m.date}: ${m.summary} (Outcomes: ${m.outcomes.join(', ')})`).join('\n')
    : 'No previous meetings';

  // Try to use the managed prompt
  const promptResult = await getPromptWithVariables('meeting_prep_brief', {
    meetingType: getMeetingTypeLabel(input.meetingType),
    companyName: input.companyName,
    attendees: attendeesList,
    dealContext: dealContextText,
    companyContext: companyContextText,
    previousMeetings: previousMeetingsText,
  });

  if (!promptResult || !promptResult.prompt) {
    console.warn('[generateMeetingPrepBrief] Failed to load meeting_prep_brief prompt, using fallback');
    // Return basic defaults
    return {
      executive_summary: `Upcoming ${getMeetingTypeLabel(input.meetingType)} with ${input.companyName}`,
      meeting_objective: 'Advance the relationship and understand their needs',
      key_talking_points: ['Introduction and context', 'Understanding current challenges', 'Presenting relevant solutions'],
      questions_to_ask: ['What are your main priorities?', 'What challenges are you facing?'],
      landmines_to_avoid: [],
      objection_prep: [],
      next_steps_to_propose: ['Schedule follow-up discussion'],
      attendee_insights: input.attendees.map(a => ({ name: a.name, title: a.title, notes: a.notes || 'No notes' })),
    };
  }

  const response = await callAIJson<{
    executive_summary: string;
    meeting_objective: string;
    key_talking_points: string[];
    questions_to_ask: string[];
    landmines_to_avoid: string[];
    objection_prep: Array<{ objection: string; response: string }>;
    next_steps_to_propose: string[];
    attendee_insights: Array<{ name: string; title?: string; notes: string }>;
  }>({
    prompt: promptResult.prompt,
    schema: promptResult.schema || undefined,
    model: (promptResult.model as 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514') || 'claude-sonnet-4-20250514',
    maxTokens: promptResult.maxTokens || 2500,
  });

  return response.data;
}
