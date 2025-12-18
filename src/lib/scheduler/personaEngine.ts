/**
 * Persona Detection & Tone Mapping Engine
 *
 * Detects contact personas based on title, behavior, and context.
 * Maps personas to appropriate communication tones and styles.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';
import { adminSchedulingService } from './schedulingService';
import {
  PersonaType,
  PersonaConfig,
  PERSONA_TYPES,
  ACTION_TYPES,
  MeetingType,
  MEETING_TYPES,
} from './types';

// ============================================
// PERSONA DETECTION
// ============================================

interface PersonaDetectionInput {
  name: string;
  title?: string;
  company?: {
    name: string;
    industry?: string;
    size?: string;
    segment?: string;
  };
  previousInteractions?: {
    responseTime?: 'fast' | 'slow' | 'never';
    preferredChannel?: string;
    communicationStyle?: string;
  };
  dealContext?: {
    stage?: string;
    value?: number;
  };
}

/**
 * Detect persona from contact information
 */
export async function detectPersona(
  input: PersonaDetectionInput
): Promise<PersonaConfig> {
  const signals: string[] = [];
  let detectedType: PersonaType = PERSONA_TYPES.OWNER_OPERATOR; // Default
  let confidence = 0.5;

  // Title-based detection
  if (input.title) {
    const titleLower = input.title.toLowerCase();

    if (/owner|ceo|president|founder|principal/i.test(titleLower)) {
      detectedType = PERSONA_TYPES.OWNER_OPERATOR;
      signals.push(`Title indicates owner/operator: "${input.title}"`);
      confidence = 0.85;
    } else if (/office manager|admin|coordinator|scheduler/i.test(titleLower)) {
      detectedType = PERSONA_TYPES.OFFICE_MANAGER;
      signals.push(`Title indicates office manager: "${input.title}"`);
      confidence = 0.8;
    } else if (/operations|ops|manager|director of ops/i.test(titleLower)) {
      detectedType = PERSONA_TYPES.OPERATIONS_LEAD;
      signals.push(`Title indicates operations: "${input.title}"`);
      confidence = 0.8;
    } else if (/it|technical|technology|systems|developer/i.test(titleLower)) {
      detectedType = PERSONA_TYPES.IT_TECHNICAL;
      signals.push(`Title indicates IT/technical: "${input.title}"`);
      confidence = 0.85;
    } else if (/vp|vice president|c-suite|cfo|coo|chief/i.test(titleLower)) {
      detectedType = PERSONA_TYPES.EXECUTIVE;
      signals.push(`Title indicates executive: "${input.title}"`);
      confidence = 0.9;
    } else if (/franchise|corporate|regional|multi-location/i.test(titleLower)) {
      detectedType = PERSONA_TYPES.FRANCHISE_CORP;
      signals.push(`Title indicates franchise/corporate: "${input.title}"`);
      confidence = 0.85;
    }
  }

  // Company context adjustments
  if (input.company) {
    if (input.company.segment === 'enterprise' || input.company.segment === 'pe_platform') {
      if (detectedType === PERSONA_TYPES.OWNER_OPERATOR) {
        detectedType = PERSONA_TYPES.EXECUTIVE;
        signals.push('Large company segment suggests executive persona');
        confidence *= 0.9;
      }
    }

    if (input.company.segment === 'franchisor') {
      detectedType = PERSONA_TYPES.FRANCHISE_CORP;
      signals.push('Franchisor segment detected');
      confidence = Math.max(confidence, 0.8);
    }

    if (input.company.size === 'smb' || input.company.segment === 'smb') {
      if (!input.title) {
        detectedType = PERSONA_TYPES.OWNER_OPERATOR;
        signals.push('SMB without title likely owner-operator');
        confidence = 0.7;
      }
    }
  }

  // Deal context adjustments
  if (input.dealContext) {
    if (input.dealContext.value && input.dealContext.value > 100000) {
      if (detectedType !== PERSONA_TYPES.EXECUTIVE) {
        signals.push('High deal value suggests executive involvement');
        confidence *= 0.95;
      }
    }
  }

  // Behavior-based adjustments
  if (input.previousInteractions) {
    if (input.previousInteractions.responseTime === 'fast') {
      signals.push('Fast response time noted');
    } else if (input.previousInteractions.responseTime === 'slow') {
      signals.push('Slow response - may be very busy');
      if (detectedType === PERSONA_TYPES.OWNER_OPERATOR) {
        confidence += 0.05; // Owners are often busy
      }
    }
  }

  return {
    type: detectedType,
    detected_at: new Date().toISOString(),
    confidence: Math.min(confidence, 1),
    signals,
  };
}

/**
 * Detect persona using AI for complex cases
 */
export async function detectPersonaWithAI(
  input: PersonaDetectionInput
): Promise<PersonaConfig> {
  try {
    const prompt = `Analyze this contact and determine their likely persona type for B2B sales communication.

## Contact Information
- Name: ${input.name}
- Title: ${input.title || 'Not specified'}
${input.company ? `- Company: ${input.company.name}
- Industry: ${input.company.industry || 'Unknown'}
- Size/Segment: ${input.company.segment || 'Unknown'}` : ''}

## Persona Types (choose one)
1. owner_operator - Busy owner, direct communication, values time
2. office_manager - Detail-oriented, follows process, needs to check with decision maker
3. operations_lead - Efficiency-focused, data-driven, cares about ROI
4. it_technical - Technical details matter, wants specifics and integrations
5. executive - High-level, strategic, very brief communications
6. franchise_corp - Multi-location focus, scalability, enterprise needs

## Task
Determine the most likely persona and explain your reasoning.`;

    const response = await callAIJson<{
      persona: PersonaType;
      confidence: number;
      signals: string[];
      reasoning: string;
    }>({
      prompt,
      systemPrompt: 'You are an expert B2B sales persona analyst specializing in pest control and service industry contacts.',
      schema: `{
        "persona": "one of the persona types listed",
        "confidence": 0.0-1.0,
        "signals": ["array of signals that indicated this persona"],
        "reasoning": "brief explanation"
      }`,
      maxTokens: 500,
      temperature: 0.3,
    });

    return {
      type: response.data.persona as PersonaType,
      detected_at: new Date().toISOString(),
      confidence: response.data.confidence,
      signals: response.data.signals,
    };

  } catch (err) {
    console.error('[PersonaEngine] AI detection failed, using rule-based:', err);
    return detectPersona(input);
  }
}

// ============================================
// TONE MAPPING
// ============================================

export type ToneStyle = 'formal' | 'casual' | 'direct' | 'consultative';

interface ToneConfig {
  style: ToneStyle;
  formality: 'high' | 'medium' | 'low';
  brevity: 'verbose' | 'balanced' | 'brief' | 'minimal';
  openingStyle: string;
  closingStyle: string;
  valueProposition: string;
  avoidPhrases: string[];
  usePhrases: string[];
}

const PERSONA_TONE_MAP: Record<PersonaType, ToneConfig> = {
  [PERSONA_TYPES.OWNER_OPERATOR]: {
    style: 'direct',
    formality: 'medium',
    brevity: 'brief',
    openingStyle: 'Get to the point quickly, acknowledge they\'re busy',
    closingStyle: 'Clear single CTA, easy to respond',
    valueProposition: 'Focus on time savings and practical results',
    avoidPhrases: ['touch base', 'circle back', 'synergy', 'leverage'],
    usePhrases: ['quick question', 'save you time', 'bottom line', 'straightforward'],
  },

  [PERSONA_TYPES.OFFICE_MANAGER]: {
    style: 'formal',
    formality: 'medium',
    brevity: 'balanced',
    openingStyle: 'Polite, professional, acknowledge their role',
    closingStyle: 'Offer flexibility, acknowledge they may need to check with others',
    valueProposition: 'Focus on process improvement and making their job easier',
    avoidPhrases: ['decision maker', 'whoever handles'],
    usePhrases: ['at your convenience', 'when it works for your team', 'easy to implement'],
  },

  [PERSONA_TYPES.OPERATIONS_LEAD]: {
    style: 'consultative',
    formality: 'medium',
    brevity: 'balanced',
    openingStyle: 'Reference operational challenges or metrics',
    closingStyle: 'Propose specific outcomes to discuss',
    valueProposition: 'Data, efficiency gains, measurable improvements',
    avoidPhrases: ['feelings', 'might', 'possibly'],
    usePhrases: ['ROI', 'efficiency', 'metrics', 'measurable results', 'data shows'],
  },

  [PERSONA_TYPES.IT_TECHNICAL]: {
    style: 'direct',
    formality: 'low',
    brevity: 'balanced',
    openingStyle: 'Technical context, specific capabilities',
    closingStyle: 'Offer technical discussion or documentation',
    valueProposition: 'Integration capabilities, API access, technical specs',
    avoidPhrases: ['magic', 'seamless', 'revolutionary', 'game-changer'],
    usePhrases: ['API', 'integration', 'technical specs', 'documentation', 'architecture'],
  },

  [PERSONA_TYPES.EXECUTIVE]: {
    style: 'formal',
    formality: 'high',
    brevity: 'minimal',
    openingStyle: 'Strategic value, board-level impact',
    closingStyle: 'Respect their time, clear ask',
    valueProposition: 'Strategic advantage, competitive edge, big picture ROI',
    avoidPhrases: ['just checking in', 'quick question', 'whenever you have a moment'],
    usePhrases: ['strategic', 'competitive advantage', 'growth', 'scale', '15 minutes'],
  },

  [PERSONA_TYPES.FRANCHISE_CORP]: {
    style: 'consultative',
    formality: 'high',
    brevity: 'balanced',
    openingStyle: 'Multi-location context, scalability focus',
    closingStyle: 'Propose enterprise-level discussion',
    valueProposition: 'Scalability, consistency across locations, enterprise support',
    avoidPhrases: ['small business', 'startup'],
    usePhrases: ['enterprise', 'multi-location', 'scalable', 'standardize', 'rollout'],
  },
};

/**
 * Get tone configuration for a persona
 */
export function getToneConfig(persona: PersonaType): ToneConfig {
  return PERSONA_TONE_MAP[persona] || PERSONA_TONE_MAP[PERSONA_TYPES.OWNER_OPERATOR];
}

/**
 * Get tone adjustments for meeting type + persona combination
 */
export function getToneForContext(
  persona: PersonaType,
  meetingType: MeetingType
): ToneConfig {
  const baseTone = getToneConfig(persona);

  // Meeting type specific adjustments
  const adjustments: Partial<ToneConfig> = {};

  switch (meetingType) {
    case MEETING_TYPES.DISCOVERY:
      adjustments.openingStyle = 'Focus on learning about their situation';
      adjustments.valueProposition = 'Understanding fit, not selling';
      break;

    case MEETING_TYPES.DEMO:
      adjustments.openingStyle = 'Reference their specific needs if known';
      adjustments.valueProposition = 'Tailored solution demonstration';
      break;

    case MEETING_TYPES.TECHNICAL:
      if (persona !== PERSONA_TYPES.IT_TECHNICAL) {
        adjustments.formality = 'medium';
        adjustments.usePhrases = [...baseTone.usePhrases, 'technical team', 'integration'];
      }
      break;

    case MEETING_TYPES.EXECUTIVE:
      adjustments.brevity = 'minimal';
      adjustments.formality = 'high';
      break;

    case MEETING_TYPES.FOLLOW_UP:
      adjustments.openingStyle = 'Reference previous conversation';
      adjustments.brevity = 'brief';
      break;
  }

  return { ...baseTone, ...adjustments };
}

// ============================================
// EMAIL TONE APPLICATION
// ============================================

/**
 * Generate system prompt additions for tone
 */
export function generateTonePromptAdditions(tone: ToneConfig): string {
  return `
## Communication Style
- Tone: ${tone.style}
- Formality: ${tone.formality}
- Brevity: ${tone.brevity}
- Opening approach: ${tone.openingStyle}
- Closing approach: ${tone.closingStyle}
- Value focus: ${tone.valueProposition}

## Phrases to USE: ${tone.usePhrases.join(', ')}
## Phrases to AVOID: ${tone.avoidPhrases.join(', ')}
`;
}

/**
 * Apply persona-based adjustments to email content
 */
export function adjustEmailForPersona(
  emailBody: string,
  persona: PersonaType
): string {
  const tone = getToneConfig(persona);
  let adjusted = emailBody;

  // Replace avoided phrases with alternatives
  const replacements: Record<string, string> = {
    'touch base': 'connect',
    'circle back': 'follow up',
    'synergy': 'alignment',
    'leverage': 'use',
    'just checking in': 'following up',
  };

  for (const [avoid, replacement] of Object.entries(replacements)) {
    if (tone.avoidPhrases.includes(avoid)) {
      const regex = new RegExp(avoid, 'gi');
      adjusted = adjusted.replace(regex, replacement);
    }
  }

  // Brevity adjustments for executives
  if (persona === PERSONA_TYPES.EXECUTIVE && adjusted.length > 500) {
    // Could implement summarization here
  }

  return adjusted;
}

// ============================================
// PERSONA PERSISTENCE
// ============================================

/**
 * Save detected persona to scheduling request
 */
export async function savePersonaToRequest(
  schedulingRequestId: string,
  persona: PersonaConfig
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('scheduling_requests')
    .update({ persona })
    .eq('id', schedulingRequestId);

  await adminSchedulingService.logAction(schedulingRequestId, {
    action_type: ACTION_TYPES.PERSONA_DETECTED,
    actor: 'ai',
    ai_reasoning: `Detected persona: ${persona.type} (${Math.round(persona.confidence * 100)}% confidence). Signals: ${persona.signals.join('; ')}`,
  });
}

/**
 * Get or detect persona for a scheduling request
 */
export async function getOrDetectPersona(
  schedulingRequestId: string
): Promise<PersonaConfig | null> {
  const supabase = createAdminClient();

  // Check if already detected
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select(`
      persona,
      attendees:scheduling_attendees(
        name, title, contact_id,
        contact:contacts(name, title, company_id)
      ),
      company:companies(name, industry, segment)
    `)
    .eq('id', schedulingRequestId)
    .single();

  if (!request) return null;

  // Return existing if available
  if (request.persona) {
    return request.persona as PersonaConfig;
  }

  // Detect from primary contact
  type AttendeeInfo = { is_primary_contact?: boolean; name?: string; title?: string; contact?: { title?: string } };
  const attendees = request.attendees as AttendeeInfo[] | undefined;
  const primaryAttendee = attendees?.find((a) => a.is_primary_contact);

  if (!primaryAttendee) return null;

  // Handle company which may come as array from Supabase join
  type CompanyInfo = { name: string; industry?: string; segment?: string };
  const companyData = request.company as unknown;
  const company = Array.isArray(companyData) ? companyData[0] as CompanyInfo | undefined : companyData as CompanyInfo | undefined;

  const persona = await detectPersona({
    name: primaryAttendee.name || 'Unknown',
    title: primaryAttendee.title || primaryAttendee.contact?.title,
    company,
  });

  // Save for future use
  await savePersonaToRequest(schedulingRequestId, persona);

  return persona;
}

// ============================================
// EXPORTS
// ============================================

export {
  type ToneConfig,
  PERSONA_TONE_MAP,
};
