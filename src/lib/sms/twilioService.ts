/**
 * Twilio SMS Service
 *
 * Handles SMS sending and receiving via Twilio.
 * Used by the AI Scheduler for multi-channel outreach.
 */

// ============================================
// TYPES
// ============================================

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface SendSmsInput {
  to: string;
  body: string;
  statusCallback?: string;  // Webhook URL for delivery status
}

interface SendSmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

interface IncomingSms {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  receivedAt: string;
}

// ============================================
// CONFIGURATION
// ============================================

function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[TwilioService] Missing Twilio configuration');
    return null;
  }

  return { accountSid, authToken, fromNumber };
}

// ============================================
// SMS SENDING
// ============================================

/**
 * Send an SMS message via Twilio
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const config = getTwilioConfig();

  if (!config) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    // Format phone number (ensure E.164 format)
    const toNumber = formatPhoneNumber(input.to);
    if (!toNumber) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // Twilio API endpoint
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;

    // Build request body
    const body = new URLSearchParams({
      To: toNumber,
      From: config.fromNumber,
      Body: input.body,
    });

    if (input.statusCallback) {
      body.append('StatusCallback', input.statusCallback);
    }

    // Make request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TwilioService] Send failed:', data);
      return {
        success: false,
        error: data.message || `Twilio error: ${response.status}`,
      };
    }

    console.log('[TwilioService] SMS sent:', data.sid);

    return {
      success: true,
      messageSid: data.sid,
    };

  } catch (err) {
    console.error('[TwilioService] Error sending SMS:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send a scheduling-related SMS
 */
export async function sendSchedulingSms(
  to: string,
  message: string,
  schedulingRequestId: string
): Promise<SendSmsResult> {
  // Add scheduling context to status callback
  const statusCallback = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/status?requestId=${schedulingRequestId}`
    : undefined;

  return sendSms({
    to,
    body: message,
    statusCallback,
  });
}

// ============================================
// SMS MESSAGE TEMPLATES
// ============================================

interface SmsTemplateContext {
  recipientName: string;
  companyName?: string;
  senderName: string;
  meetingType: string;
  duration: number;
  proposedTimes?: string[];
  meetingLink?: string;
  scheduledTime?: string;
}

/**
 * Generate initial outreach SMS (short, direct)
 */
export function generateInitialSms(ctx: SmsTemplateContext): string {
  const firstName = ctx.recipientName.split(' ')[0];
  const times = ctx.proposedTimes?.slice(0, 2).join(' or ') || 'this week';

  return `Hi ${firstName}, this is ${ctx.senderName}. Would you have ${ctx.duration} min ${times} for a quick ${ctx.meetingType} call? Reply with a time that works or "call me" and I'll ring you.`;
}

/**
 * Generate follow-up SMS
 */
export function generateFollowUpSms(ctx: SmsTemplateContext, attemptNumber: number): string {
  const firstName = ctx.recipientName.split(' ')[0];

  if (attemptNumber === 1) {
    return `Hi ${firstName}, just following up on the ${ctx.meetingType} - still interested in connecting? Reply with a good time or "not now" if timing is off.`;
  }

  // More casual on 2nd+ attempt
  return `Hey ${firstName}, wanted to touch base one more time. Would a quick ${ctx.duration}-min call work? Just reply when's good.`;
}

/**
 * Generate confirmation SMS
 */
export function generateConfirmationSms(ctx: SmsTemplateContext): string {
  const firstName = ctx.recipientName.split(' ')[0];

  let msg = `Great! Confirmed: ${ctx.meetingType} on ${ctx.scheduledTime}.`;

  if (ctx.meetingLink) {
    msg += ` Join link: ${ctx.meetingLink}`;
  }

  msg += ` - ${ctx.senderName}`;

  return msg;
}

/**
 * Generate reminder SMS
 */
export function generateReminderSms(ctx: SmsTemplateContext): string {
  const firstName = ctx.recipientName.split(' ')[0];

  let msg = `Reminder: ${ctx.meetingType} today at ${ctx.scheduledTime}.`;

  if (ctx.meetingLink) {
    msg += ` Join: ${ctx.meetingLink}`;
  }

  msg += ` See you soon! - ${ctx.senderName}`;

  return msg;
}

/**
 * Generate de-escalation SMS (offering shorter meeting)
 */
export function generateDeEscalationSms(ctx: SmsTemplateContext, newDuration: number): string {
  const firstName = ctx.recipientName.split(' ')[0];

  return `Hi ${firstName}, I know you're busy - would a quick ${newDuration}-min intro call work better? Just enough time to see if we can help. Reply with a time that works.`;
}

// ============================================
// PHONE NUMBER UTILITIES
// ============================================

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string | null {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Handle US numbers
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Already has country code
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // International format
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Check if a phone number is valid for SMS
 */
export function isValidSmsNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  return formatted !== null && formatted.length >= 11;
}

/**
 * Extract phone number from contact info
 */
export function extractPhoneFromContact(contact: {
  phone?: string | null;
  mobile?: string | null;
  work_phone?: string | null;
}): string | null {
  // Prefer mobile, then phone, then work
  const candidates = [contact.mobile, contact.phone, contact.work_phone];

  for (const phone of candidates) {
    if (phone && isValidSmsNumber(phone)) {
      return formatPhoneNumber(phone);
    }
  }

  return null;
}

// ============================================
// SMS PARSING
// ============================================

/**
 * Parse incoming SMS for scheduling intent
 */
export function parseSmsIntent(body: string): {
  intent: 'accept' | 'decline' | 'call_request' | 'time_suggestion' | 'question' | 'unclear';
  extractedTime?: string;
  details?: string;
} {
  const lower = body.toLowerCase().trim();

  // Decline patterns
  if (/\b(no|not interested|stop|unsubscribe|remove|not now|pass)\b/.test(lower)) {
    return { intent: 'decline' };
  }

  // Call request patterns
  if (/\b(call me|give me a call|ring me|phone me)\b/.test(lower)) {
    return { intent: 'call_request' };
  }

  // Accept/confirmation patterns
  if (/\b(yes|sure|sounds good|perfect|great|works|ok|okay|confirmed)\b/.test(lower)) {
    // Try to extract time if mentioned
    const timeMatch = lower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      return { intent: 'accept', extractedTime: timeMatch[1] };
    }
    return { intent: 'accept' };
  }

  // Time suggestion patterns
  const timePatterns = [
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(tomorrow|today|next week)\b/i,
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
    /\b(\d{1,2}\/\d{1,2})\b/, // Date pattern
  ];

  for (const pattern of timePatterns) {
    const match = lower.match(pattern);
    if (match) {
      return {
        intent: 'time_suggestion',
        extractedTime: match[1],
        details: body,
      };
    }
  }

  // Question patterns
  if (/\?|what|when|where|how|who|which/.test(lower)) {
    return { intent: 'question', details: body };
  }

  return { intent: 'unclear', details: body };
}

// ============================================
// EXPORTS
// ============================================

export {
  type TwilioConfig,
  type SendSmsInput,
  type SendSmsResult,
  type IncomingSms,
  type SmsTemplateContext,
};
