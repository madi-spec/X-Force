/**
 * Memory Injection Service
 *
 * Provides account memory context to AI jobs for personalized outputs.
 * Memory includes: what works, what doesn't, communication preferences,
 * decision style, objections encountered, and rapport builders.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export interface AccountMemoryContext {
  // What works
  resonates: string[];
  effectiveAngles: string[];

  // What doesn't work
  avoided: string[];
  failedApproaches: string[];

  // Communication preferences
  preferredChannel: string | null;
  responsePattern: string | null;
  formalityLevel: string | null;
  bestTimeToReach: string | null;

  // Decision style
  decisionStyle: string | null;
  typicalTimeline: string | null;
  keyConcerns: string[];

  // Objections
  objections: Array<{
    objection: string;
    responseWorked: string;
    resolved: boolean;
  }>;

  // Rapport
  rapportBuilders: string[];
  personalNotes: string[];

  // Outcome learnings
  lastWinTheme: string | null;
  lastLossReason: string | null;

  // Metadata
  hasMemory: boolean;
}

// ============================================
// FETCH MEMORY
// ============================================

export async function getAccountMemory(companyId: string): Promise<AccountMemoryContext> {
  const supabase = createAdminClient();

  const { data: memory } = await supabase
    .from('account_memory')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!memory) {
    return getEmptyMemoryContext();
  }

  return {
    resonates: (memory.resonates as string[]) || [],
    effectiveAngles: (memory.effective_angles as string[]) || [],
    avoided: (memory.avoided as string[]) || [],
    failedApproaches: (memory.failed_approaches as string[]) || [],
    preferredChannel: memory.preferred_channel,
    responsePattern: memory.response_pattern,
    formalityLevel: memory.formality_level,
    bestTimeToReach: memory.best_time_to_reach,
    decisionStyle: memory.decision_style,
    typicalTimeline: memory.typical_timeline,
    keyConcerns: (memory.key_concerns as string[]) || [],
    objections: ((memory.objections_encountered as Array<{
      objection: string;
      response_that_worked: string;
      resolved: boolean;
    }>) || []).map(o => ({
      objection: o.objection,
      responseWorked: o.response_that_worked,
      resolved: o.resolved,
    })),
    rapportBuilders: (memory.rapport_builders as string[]) || [],
    personalNotes: ((memory.personal_notes as Array<{ note: string }>) || []).map(n => n.note),
    lastWinTheme: memory.last_win_theme,
    lastLossReason: memory.last_loss_reason,
    hasMemory: true,
  };
}

function getEmptyMemoryContext(): AccountMemoryContext {
  return {
    resonates: [],
    effectiveAngles: [],
    avoided: [],
    failedApproaches: [],
    preferredChannel: null,
    responsePattern: null,
    formalityLevel: null,
    bestTimeToReach: null,
    decisionStyle: null,
    typicalTimeline: null,
    keyConcerns: [],
    objections: [],
    rapportBuilders: [],
    personalNotes: [],
    lastWinTheme: null,
    lastLossReason: null,
    hasMemory: false,
  };
}

// ============================================
// FORMAT FOR PROMPTS
// ============================================

/**
 * Format memory context for AI prompt injection.
 * Returns a human-readable summary suitable for context.
 */
export function formatMemoryForPrompt(memory: AccountMemoryContext): string {
  if (!memory.hasMemory) {
    return 'No account memory available for this company.';
  }

  const sections: string[] = [];

  // What Works
  if (memory.resonates.length > 0 || memory.effectiveAngles.length > 0) {
    const works: string[] = [];
    if (memory.resonates.length > 0) {
      works.push(`Messages that resonate: ${memory.resonates.join(', ')}`);
    }
    if (memory.effectiveAngles.length > 0) {
      works.push(`Effective angles: ${memory.effectiveAngles.join(', ')}`);
    }
    sections.push(`**What Works:**\n${works.join('\n')}`);
  }

  // What Doesn't Work
  if (memory.avoided.length > 0 || memory.failedApproaches.length > 0) {
    const doesnt: string[] = [];
    if (memory.avoided.length > 0) {
      doesnt.push(`Topics to avoid: ${memory.avoided.join(', ')}`);
    }
    if (memory.failedApproaches.length > 0) {
      doesnt.push(`Failed approaches: ${memory.failedApproaches.join(', ')}`);
    }
    sections.push(`**What Doesn't Work:**\n${doesnt.join('\n')}`);
  }

  // Communication Preferences
  const comms: string[] = [];
  if (memory.preferredChannel) {
    comms.push(`Preferred channel: ${formatPreference(memory.preferredChannel)}`);
  }
  if (memory.responsePattern) {
    comms.push(`Response pattern: ${formatPreference(memory.responsePattern)}`);
  }
  if (memory.formalityLevel) {
    comms.push(`Formality: ${formatPreference(memory.formalityLevel)}`);
  }
  if (memory.bestTimeToReach) {
    comms.push(`Best time to reach: ${memory.bestTimeToReach}`);
  }
  if (comms.length > 0) {
    sections.push(`**Communication Style:**\n${comms.join('\n')}`);
  }

  // Decision Style
  const decision: string[] = [];
  if (memory.decisionStyle) {
    decision.push(`Decision style: ${formatDecisionStyle(memory.decisionStyle)}`);
  }
  if (memory.typicalTimeline) {
    decision.push(`Typical timeline: ${memory.typicalTimeline}`);
  }
  if (memory.keyConcerns.length > 0) {
    decision.push(`Key concerns: ${memory.keyConcerns.join(', ')}`);
  }
  if (decision.length > 0) {
    sections.push(`**Decision Making:**\n${decision.join('\n')}`);
  }

  // Objections
  if (memory.objections.length > 0) {
    const objections = memory.objections.map(o => {
      if (o.responseWorked) {
        return `- "${o.objection}" → Response that worked: "${o.responseWorked}"`;
      }
      return `- "${o.objection}" (unresolved)`;
    });
    sections.push(`**Known Objections:**\n${objections.join('\n')}`);
  }

  // Rapport Builders
  if (memory.rapportBuilders.length > 0) {
    sections.push(`**Rapport Builders:**\n${memory.rapportBuilders.join(', ')}`);
  }

  // Outcome Learnings
  const learnings: string[] = [];
  if (memory.lastWinTheme) {
    learnings.push(`Last win theme: ${memory.lastWinTheme}`);
  }
  if (memory.lastLossReason) {
    learnings.push(`Last loss reason: ${memory.lastLossReason}`);
  }
  if (learnings.length > 0) {
    sections.push(`**Outcome Learnings:**\n${learnings.join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Format memory as structured JSON for AI tool use.
 */
export function formatMemoryForStructuredPrompt(memory: AccountMemoryContext): object {
  if (!memory.hasMemory) {
    return { hasMemory: false };
  }

  return {
    hasMemory: true,
    whatWorks: {
      resonates: memory.resonates,
      effectiveAngles: memory.effectiveAngles,
    },
    whatDoesntWork: {
      avoided: memory.avoided,
      failedApproaches: memory.failedApproaches,
    },
    communicationPreferences: {
      channel: memory.preferredChannel,
      responsePattern: memory.responsePattern,
      formality: memory.formalityLevel,
      bestTime: memory.bestTimeToReach,
    },
    decisionMaking: {
      style: memory.decisionStyle,
      timeline: memory.typicalTimeline,
      concerns: memory.keyConcerns,
    },
    objections: memory.objections,
    rapportBuilders: memory.rapportBuilders,
    learnings: {
      lastWin: memory.lastWinTheme,
      lastLoss: memory.lastLossReason,
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatPreference(value: string): string {
  const labels: Record<string, string> = {
    phone: 'Phone calls',
    email: 'Email',
    linkedin: 'LinkedIn',
    video: 'Video calls',
    quick: 'Quick responder',
    deliberate: 'Deliberate (takes time)',
    sporadic: 'Sporadic responses',
    formal: 'Formal communication',
    casual: 'Casual communication',
    mixed: 'Mixed formality',
  };
  return labels[value] || value;
}

function formatDecisionStyle(style: string): string {
  const labels: Record<string, string> = {
    owner_led: 'Owner-led (single decision maker)',
    consensus: 'Consensus-driven (team input required)',
    committee: 'Committee-based (formal approval process)',
    financial: 'Finance-driven (ROI focused)',
  };
  return labels[style] || style;
}

// ============================================
// PROMPT BUILDER HELPERS
// ============================================

/**
 * Get communication guidance based on memory.
 */
export function getCommunicationGuidance(memory: AccountMemoryContext): string[] {
  const guidance: string[] = [];

  if (memory.preferredChannel) {
    guidance.push(`Prefer ${formatPreference(memory.preferredChannel)} for outreach`);
  }

  if (memory.formalityLevel === 'formal') {
    guidance.push('Use formal, professional language');
  } else if (memory.formalityLevel === 'casual') {
    guidance.push('Use friendly, casual tone');
  }

  if (memory.bestTimeToReach) {
    guidance.push(`Best time to reach: ${memory.bestTimeToReach}`);
  }

  if (memory.responsePattern === 'deliberate') {
    guidance.push('Expect delayed responses - be patient');
  } else if (memory.responsePattern === 'sporadic') {
    guidance.push('Response patterns are inconsistent - follow up proactively');
  }

  return guidance;
}

/**
 * Get talking points enhanced with memory context.
 */
export function enhanceTalkingPoints(
  baseTalkingPoints: string[],
  memory: AccountMemoryContext
): string[] {
  const enhanced = [...baseTalkingPoints];

  // Add rapport builder at the start if available
  if (memory.rapportBuilders.length > 0) {
    enhanced.unshift(`(Rapport builder: ${memory.rapportBuilders[0]})`);
  }

  // Add resonating message if available
  if (memory.resonates.length > 0) {
    enhanced.push(`Emphasize: "${memory.resonates[0]}" (resonated before)`);
  }

  return enhanced;
}

/**
 * Get things to avoid based on memory.
 */
export function getAvoidList(memory: AccountMemoryContext): string[] {
  const avoid: string[] = [];

  if (memory.avoided.length > 0) {
    memory.avoided.forEach(a => avoid.push(`Avoid: ${a}`));
  }

  if (memory.failedApproaches.length > 0) {
    memory.failedApproaches.forEach(f => avoid.push(`Don't try: ${f} (didn't work before)`));
  }

  // Add objection-related warnings
  const unresolvedObjections = memory.objections.filter(o => !o.resolved);
  if (unresolvedObjections.length > 0) {
    avoid.push(`Be prepared for objection: "${unresolvedObjections[0].objection}"`);
  }

  return avoid;
}
