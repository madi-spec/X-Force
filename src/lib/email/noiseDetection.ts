/**
 * Email Noise Detection
 *
 * Identifies emails that should be automatically processed without human review.
 * This is sender/domain-based filtering, NOT content keyword matching.
 *
 * Use cases:
 * - AI meeting notetakers (Fireflies, Otter, etc.) - informational recaps
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

export interface NoiseClassification {
  isNoise: boolean;
  noiseType: 'ai_notetaker' | 'marketing' | 'system' | null;
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
  _subject?: string | null,
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
