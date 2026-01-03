/**
 * Email Noise Detection
 *
 * Identifies emails that should be automatically processed without human review.
 * This is sender/domain-based filtering, NOT content keyword matching.
 *
 * Use cases:
 * - AI meeting notetakers (Fireflies, Otter, etc.) - informational recaps
 * - Calendar notifications (accepted, declined, canceled meetings)
 * - Marketing automation (future)
 * - System notifications (future)
 */

// AI Notetaker domains - these send meeting recaps that don't need response
const AI_NOTETAKER_DOMAINS = [
  // Primary notetakers
  'fireflies.ai',
  'otter.ai',
  'grain.com',
  'grain.co',
  'fathom.video',
  'avoma.com',
  'gong.io',
  'chorus.ai',
  'tldv.io',
  'fellow.app',
  'vowel.com',
  'read.ai',
  'tactiq.io',
  'sembly.ai',
  'krisp.ai',
  'supernormal.com',
  'meetgeek.ai',
  'notta.ai',
  'airgram.io',
  'jamie-ai.com',
  'colibri.ai',
  'recall.ai',
  'bluedot.so',
  'circleback.ai',
];

// Specific sender patterns (email prefix + domain combinations)
const AI_NOTETAKER_SENDERS = [
  'no-reply@fireflies.ai',
  'notifications@fireflies.ai',
  'meeting@fireflies.ai',
  'noreply@otter.ai',
  'notifications@otter.ai',
  'hello@grain.com',
  'notifications@grain.com',
  'no-reply@fathom.video',
  'noreply@gong.io',
  'notifications@gong.io',
];

// Calendar notification senders - automated calendar responses
const CALENDAR_NOTIFICATION_SENDERS = [
  // Google Calendar
  'calendar-notification@google.com',
  'calendar@google.com',
  // Microsoft / Outlook
  'noreply@microsoft.com',
  'no-reply@microsoft.com',
  'calendar-noreply@google.com',
  // Calendly
  'notifications@calendly.com',
  'noreply@calendly.com',
  // Other calendar services
  'noreply@zoom.us',
  'no-reply@zoom.us',
  'notifications@hubspot.com',
];

// Subject patterns that indicate calendar notifications
// These are case-insensitive prefixes
const CALENDAR_SUBJECT_PREFIXES = [
  'accepted:',
  'declined:',
  'tentative:',
  'canceled:',
  'cancelled:',
  'updated:',
  'invitation:',
  // Common variations
  'meeting accepted:',
  'meeting declined:',
  'meeting canceled:',
  'meeting cancelled:',
  'calendar:',
  // Outlook patterns
  'fw: accepted:',
  'fw: declined:',
  're: accepted:',
  're: declined:',
];

export interface NoiseClassification {
  isNoise: boolean;
  noiseType: 'ai_notetaker' | 'calendar' | 'marketing' | 'system' | null;
  reason: string | null;
  autoProcess: boolean;
}

/**
 * Check if an email is from an AI notetaker service
 */
export function isAINotetakerEmail(fromEmail: string | null | undefined): boolean {
  if (!fromEmail) return false;

  const email = fromEmail.toLowerCase().trim();

  // Check exact sender matches first
  if (AI_NOTETAKER_SENDERS.includes(email)) {
    return true;
  }

  // Check domain matches
  const domain = email.split('@')[1];
  if (domain && AI_NOTETAKER_DOMAINS.includes(domain)) {
    return true;
  }

  return false;
}

/**
 * Check if an email is an automated calendar notification
 * Uses both sender-based and subject-based detection
 */
export function isCalendarNotificationEmail(
  fromEmail: string | null | undefined,
  subject: string | null | undefined
): { isCalendar: boolean; calendarAction: string | null } {
  const email = (fromEmail || '').toLowerCase().trim();
  const subjectLower = (subject || '').toLowerCase().trim();

  // Check if from a known calendar notification sender
  if (CALENDAR_NOTIFICATION_SENDERS.includes(email)) {
    // Extract the action from the subject if possible
    const action = extractCalendarAction(subjectLower);
    return { isCalendar: true, calendarAction: action };
  }

  // Check subject prefixes for calendar patterns
  for (const prefix of CALENDAR_SUBJECT_PREFIXES) {
    if (subjectLower.startsWith(prefix)) {
      const action = extractCalendarAction(subjectLower);
      return { isCalendar: true, calendarAction: action };
    }
  }

  return { isCalendar: false, calendarAction: null };
}

/**
 * Extract the calendar action type from subject line
 */
function extractCalendarAction(subject: string): string {
  const lower = subject.toLowerCase();
  if (lower.includes('accepted')) return 'Accepted';
  if (lower.includes('declined')) return 'Declined';
  if (lower.includes('tentative')) return 'Tentative';
  if (lower.includes('canceled') || lower.includes('cancelled')) return 'Canceled';
  if (lower.includes('updated')) return 'Updated';
  if (lower.includes('invitation')) return 'Invitation';
  return 'Calendar notification';
}

/**
 * Get the notetaker service name for display
 */
export function getNotetakerServiceName(fromEmail: string | null | undefined): string | null {
  if (!fromEmail) return null;

  const email = fromEmail.toLowerCase().trim();
  const domain = email.split('@')[1];

  if (!domain) return null;

  // Map domains to friendly names
  const serviceNames: Record<string, string> = {
    'fireflies.ai': 'Fireflies',
    'otter.ai': 'Otter.ai',
    'grain.com': 'Grain',
    'grain.co': 'Grain',
    'fathom.video': 'Fathom',
    'avoma.com': 'Avoma',
    'gong.io': 'Gong',
    'chorus.ai': 'Chorus',
    'tldv.io': 'tl;dv',
    'fellow.app': 'Fellow',
    'vowel.com': 'Vowel',
    'read.ai': 'Read AI',
    'tactiq.io': 'Tactiq',
    'sembly.ai': 'Sembly',
    'krisp.ai': 'Krisp',
    'supernormal.com': 'Supernormal',
    'meetgeek.ai': 'MeetGeek',
    'notta.ai': 'Notta',
    'airgram.io': 'Airgram',
    'jamie-ai.com': 'Jamie',
    'colibri.ai': 'Colibri',
    'recall.ai': 'Recall.ai',
    'bluedot.so': 'Bluedot',
    'circleback.ai': 'Circleback',
  };

  return serviceNames[domain] || null;
}

/**
 * Classify an email for noise filtering
 * Returns classification with whether to auto-process
 */
export function classifyEmailNoise(
  fromEmail: string | null | undefined,
  subject?: string | null,
  _bodyPreview?: string | null
): NoiseClassification {
  // Check AI notetakers (domain-based, not content)
  if (isAINotetakerEmail(fromEmail)) {
    const serviceName = getNotetakerServiceName(fromEmail);
    return {
      isNoise: true,
      noiseType: 'ai_notetaker',
      reason: serviceName
        ? `Meeting recap from ${serviceName}`
        : 'Meeting recap from AI notetaker',
      autoProcess: true,
    };
  }

  // Check calendar notifications (sender + subject-based)
  const calendarCheck = isCalendarNotificationEmail(fromEmail, subject);
  if (calendarCheck.isCalendar) {
    return {
      isNoise: true,
      noiseType: 'calendar',
      reason: calendarCheck.calendarAction
        ? `${calendarCheck.calendarAction} meeting response`
        : 'Calendar notification',
      autoProcess: true,
    };
  }

  // Not noise - requires normal processing
  return {
    isNoise: false,
    noiseType: null,
    reason: null,
    autoProcess: false,
  };
}

/**
 * Get list of all AI notetaker domains (for debugging/admin)
 */
export function getAINotetakerDomains(): string[] {
  return [...AI_NOTETAKER_DOMAINS];
}
