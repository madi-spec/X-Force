/**
 * AI Email Generation for Scheduling
 *
 * Generates professional, contextual scheduling emails using Claude AI.
 * Supports initial outreach, follow-ups, confirmations, reminders, and no-show handling.
 */

import { callAIJson } from '@/lib/ai/core/aiClient';
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

  const response = await callAIJson<{
    subject: string;
    body: string;
    reasoning: string;
  }>({
    prompt,
    systemPrompt: SCHEDULING_EMAIL_SYSTEM_PROMPT,
    schema: `{
      "subject": "Email subject line (concise, professional)",
      "body": "Full email body with proper formatting",
      "reasoning": "Brief explanation of approach taken"
    }`,
    maxTokens: 2000,
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

  const response = await callAIJson<{
    variants: Array<{ subject: string; body: string }>;
  }>({
    prompt,
    systemPrompt: SCHEDULING_EMAIL_SYSTEM_PROMPT,
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
// PROMPT BUILDERS
// ============================================

const SCHEDULING_EMAIL_SYSTEM_PROMPT = `You are an expert B2B sales email writer specializing in meeting scheduling.

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

For time proposals:
- Always include day of week for clarity
- Use 12-hour format with timezone
- Offer 3-4 options spanning different days/times
- Present in an easy-to-scan format

CRITICAL DATE HANDLING - READ CAREFULLY:
- The current date and year is provided in the prompt - USE IT EXACTLY
- The proposed times show VERIFIED day/date pairs - they are CORRECT
- When you write the email, use the EXACT same dates provided
- Do NOT add 1 to dates. Do NOT "fix" dates. Trust the input.

CRITICAL YEAR HANDLING:
- Look at TODAY'S DATE in the prompt. Use THAT year in any seasonal greetings.
- If today is December 2025, write "end of 2025", NOT "end of 2024"
- If today is January 2026, write "start of 2026" or "new year", NOT "2025"
- NEVER guess the year - ALWAYS check the TODAY'S DATE provided in the prompt
- Around the holidays, be especially careful: "Hope you're having a great holiday season" is safer than referencing a specific year incorrectly.

IMPORTANT: Generate actual email content, not placeholders. Use the provided context to personalize.`;

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
  const current = new Date(dateRangeStart);

  // Time ranges for each period
  const timeRanges = {
    morning: { start: 9, end: 12 },
    afternoon: { start: 13, end: 17 },
    evening: { start: 17, end: 19 },
  };

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

    // Add slots for each preferred time period
    if (preferences.morning && slots.length < count) {
      const slot = new Date(current);
      slot.setHours(10, 0, 0, 0);
      slots.push(slot);
    }
    if (preferences.afternoon && slots.length < count) {
      const slot = new Date(current);
      slot.setHours(14, 0, 0, 0);
      slots.push(slot);
    }
    if (preferences.evening && slots.length < count) {
      const slot = new Date(current);
      slot.setHours(17, 30, 0, 0);
      slots.push(slot);
    }

    current.setDate(current.getDate() + 1);
  }

  return slots.slice(0, count);
}

// ============================================
// EMAIL PARSING
// ============================================

/**
 * Parses an incoming email to detect scheduling intent
 */
export async function parseSchedulingResponse(
  emailBody: string,
  proposedTimes: string[]
): Promise<{
  intent: 'accept' | 'decline' | 'counter_propose' | 'question' | 'unclear';
  selectedTime?: string;
  counterProposedTimes?: string[];
  question?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  reasoning: string;
}> {
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
${yearGuidance}

## Proposed Times
${proposedTimes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Email Response
${emailBody}

## Task
Determine:
1. Intent: Are they accepting a time, declining, proposing alternatives, asking a question, or unclear?
2. If accepting: Which specific time did they select?
3. If counter-proposing: What times are they suggesting? Return these as ISO timestamps (e.g., "${nextYear}-01-06T11:00:00")
   - IMPORTANT: When they say "Monday the 5th" - the NUMBER 5th is the key, find the month where the 5th is (near) a Monday
   - If they say "11am on Monday the 5th" and January 5, ${nextYear} is a Monday, return "${nextYear}-01-05T11:00:00"
4. If questioning: What is their question?
5. Overall sentiment toward the meeting`;

  const response = await callAIJson<{
    intent: 'accept' | 'decline' | 'counter_propose' | 'question' | 'unclear';
    selectedTime?: string;
    counterProposedTimes?: string[];
    question?: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    reasoning: string;
  }>({
    prompt,
    systemPrompt:
      'You are an expert at understanding email intent, especially for scheduling contexts. Analyze carefully and extract structured information.',
    schema: `{
      "intent": "accept|decline|counter_propose|question|unclear",
      "selectedTime": "ISO timestamp if they selected a specific time",
      "counterProposedTimes": ["Array of times they suggested if counter-proposing"],
      "question": "Their question if asking one",
      "sentiment": "positive|neutral|negative",
      "reasoning": "Brief explanation of your analysis"
    }`,
    maxTokens: 1000,
    temperature: 0.3,
  });

  return response.data;
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
  const prompt = `Generate a comprehensive meeting prep brief.

## Meeting Details
- Type: ${getMeetingTypeLabel(input.meetingType)}
- Company: ${input.companyName}
${input.companyContext ? `- Industry: ${input.companyContext.industry}\n- Size: ${input.companyContext.size}` : ''}

## Attendees
${input.attendees.map((a) => `- ${a.name}${a.title ? ` (${a.title})` : ''}${a.notes ? `: ${a.notes}` : ''}`).join('\n')}

${
  input.dealContext
    ? `## Deal Context
- Stage: ${input.dealContext.stage}
- History: ${input.dealContext.history}
- Key Points: ${input.dealContext.keyPoints.join(', ')}
- Known Objections: ${input.dealContext.objections.join(', ')}`
    : ''
}

${
  input.previousMeetings && input.previousMeetings.length > 0
    ? `## Previous Meetings
${input.previousMeetings.map((m) => `### ${m.date}\n${m.summary}\nOutcomes: ${m.outcomes.join(', ')}`).join('\n\n')}`
    : ''
}

## Task
Create a detailed prep brief to help the sales rep succeed in this meeting.`;

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
    prompt,
    systemPrompt: `You are an expert sales coach preparing reps for important meetings.
Your prep briefs are:
- Highly specific to the company and deal
- Action-oriented with concrete talking points
- Realistic about potential objections
- Focused on advancing the deal

Context: Pest control / lawn care industry, selling Voice phone systems and X-RAI AI platform.`,
    schema: `{
      "executive_summary": "2-3 sentence overview of the opportunity",
      "meeting_objective": "The ONE primary outcome we're trying to achieve",
      "key_talking_points": ["3-5 specific points to cover"],
      "questions_to_ask": ["4-6 strategic questions to uncover needs"],
      "landmines_to_avoid": ["2-3 topics to be careful around"],
      "objection_prep": [
        { "objection": "Common objection", "response": "How to handle it" }
      ],
      "next_steps_to_propose": ["2-3 concrete next steps"],
      "attendee_insights": [
        { "name": "Person name", "title": "Their role", "notes": "Key things to know" }
      ]
    }`,
    maxTokens: 2500,
    temperature: 0.6,
  });

  return response.data;
}
