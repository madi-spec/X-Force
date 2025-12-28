/**
 * Memory Capture Service
 *
 * Extracts learnings from meeting analyses and other sources
 * to automatically suggest updates to account memory.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { MeetingAnalysis } from '@/types';

// ============================================
// TYPES
// ============================================

export interface MemorySuggestion {
  field: string;
  value: string;
  source: 'meeting_analysis' | 'email_analysis' | 'postmortem';
  sourceId: string;
  confidence: number;
  reasoning: string;
}

export interface MemoryCaptureResult {
  suggestions: MemorySuggestion[];
  autoApplied: string[];
  errors: string[];
}

// ============================================
// MAIN CAPTURE FUNCTION
// ============================================

/**
 * Process a meeting analysis and extract memory updates.
 * High-confidence learnings are auto-applied, others are suggested.
 */
export async function captureMeetingLearnings(
  companyId: string,
  transcriptionId: string,
  analysis: MeetingAnalysis,
  autoApplyThreshold: number = 0.8
): Promise<MemoryCaptureResult> {
  const suggestions: MemorySuggestion[] = [];
  const autoApplied: string[] = [];
  const errors: string[] = [];

  // Extract learnings from different parts of the analysis
  const objectionLearnings = extractObjectionLearnings(analysis, transcriptionId);
  const communicationLearnings = extractCommunicationLearnings(analysis, transcriptionId);
  const sentimentLearnings = extractSentimentLearnings(analysis, transcriptionId);
  const rapportLearnings = extractRapportLearnings(analysis, transcriptionId);

  const allSuggestions = [
    ...objectionLearnings,
    ...communicationLearnings,
    ...sentimentLearnings,
    ...rapportLearnings,
  ];

  // Process each suggestion
  const supabase = createAdminClient();

  for (const suggestion of allSuggestions) {
    if (suggestion.confidence >= autoApplyThreshold) {
      // Auto-apply high-confidence learnings
      try {
        await applyMemoryUpdate(supabase, companyId, suggestion);
        autoApplied.push(`${suggestion.field}: ${suggestion.value}`);
      } catch (err) {
        errors.push(`Failed to apply ${suggestion.field}: ${(err as Error).message}`);
        suggestions.push(suggestion);
      }
    } else {
      // Queue for manual review
      suggestions.push(suggestion);
    }
  }

  // Log that we captured learnings
  if (autoApplied.length > 0 || suggestions.length > 0) {
    console.log(`[Memory Capture] Company ${companyId}: ${autoApplied.length} auto-applied, ${suggestions.length} suggested`);
  }

  return { suggestions, autoApplied, errors };
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

function extractObjectionLearnings(
  analysis: MeetingAnalysis,
  sourceId: string
): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];

  if (!analysis.objections || analysis.objections.length === 0) {
    return suggestions;
  }

  for (const objection of analysis.objections) {
    // Add the objection itself to memory
    suggestions.push({
      field: 'objections_encountered',
      value: JSON.stringify({
        objection: objection.objection,
        response_that_worked: objection.howAddressed || '',
        date: new Date().toISOString(),
        resolved: objection.resolved || false,
      }),
      source: 'meeting_analysis',
      sourceId,
      confidence: 0.85,
      reasoning: `Objection "${objection.objection}" was raised during the meeting`,
    });

    // If resolved, add the successful response as an effective angle
    if (objection.resolved && objection.howAddressed) {
      suggestions.push({
        field: 'effective_angles',
        value: objection.howAddressed,
        source: 'meeting_analysis',
        sourceId,
        confidence: 0.75,
        reasoning: `This response successfully addressed the objection: "${objection.objection}"`,
      });
    }
  }

  return suggestions;
}

function extractCommunicationLearnings(
  analysis: MeetingAnalysis,
  sourceId: string
): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];

  if (!analysis.stakeholders || analysis.stakeholders.length === 0) {
    return suggestions;
  }

  // Look for communication preferences from stakeholders
  for (const stakeholder of analysis.stakeholders) {
    if (stakeholder.communicationInsights) {
      const insights = stakeholder.communicationInsights;

      if (insights.preferredChannel) {
        suggestions.push({
          field: 'preferred_channel',
          value: insights.preferredChannel,
          source: 'meeting_analysis',
          sourceId,
          confidence: 0.7,
          reasoning: `${stakeholder.name} indicated preference for ${insights.preferredChannel} communication`,
        });
      }

      if (insights.communicationTone) {
        const formalityMap: Record<string, string> = {
          formal: 'formal',
          casual: 'casual',
          technical: 'formal', // Technical tends to be formal
        };
        suggestions.push({
          field: 'formality_level',
          value: formalityMap[insights.communicationTone] || 'mixed',
          source: 'meeting_analysis',
          sourceId,
          confidence: 0.65,
          reasoning: `${stakeholder.name}'s communication style is ${insights.communicationTone}`,
        });
      }
    }
  }

  return suggestions;
}

function extractSentimentLearnings(
  analysis: MeetingAnalysis,
  sourceId: string
): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];

  if (!analysis.sentiment) {
    return suggestions;
  }

  // Extract buying signals as things that resonate
  if (analysis.buyingSignals && analysis.buyingSignals.length > 0) {
    for (const signal of analysis.buyingSignals) {
      if (signal.strength === 'strong' || signal.strength === 'moderate') {
        suggestions.push({
          field: 'resonates',
          value: signal.signal,
          source: 'meeting_analysis',
          sourceId,
          confidence: signal.strength === 'strong' ? 0.85 : 0.7,
          reasoning: `This generated a ${signal.strength} buying signal during the meeting`,
        });
      }
    }
  }

  // Extract key concerns
  if (analysis.extractedInfo?.painPoints && analysis.extractedInfo.painPoints.length > 0) {
    for (const painPoint of analysis.extractedInfo.painPoints) {
      suggestions.push({
        field: 'key_concerns',
        value: painPoint,
        source: 'meeting_analysis',
        sourceId,
        confidence: 0.8,
        reasoning: `This was mentioned as a pain point during the meeting`,
      });
    }
  }

  // Extract decision process info
  if (analysis.extractedInfo?.decisionProcess) {
    const decisionMap: Record<string, string> = {
      owner: 'owner_led',
      consensus: 'consensus',
      committee: 'committee',
      finance: 'financial',
      cfo: 'financial',
      budget: 'financial',
    };

    const processText = analysis.extractedInfo.decisionProcess.toLowerCase();
    for (const [keyword, style] of Object.entries(decisionMap)) {
      if (processText.includes(keyword)) {
        suggestions.push({
          field: 'decision_style',
          value: style,
          source: 'meeting_analysis',
          sourceId,
          confidence: 0.7,
          reasoning: `Decision process mentioned: "${analysis.extractedInfo.decisionProcess}"`,
        });
        break;
      }
    }
  }

  // Extract timeline info
  if (analysis.extractedInfo?.timeline) {
    suggestions.push({
      field: 'typical_timeline',
      value: analysis.extractedInfo.timeline,
      source: 'meeting_analysis',
      sourceId,
      confidence: 0.75,
      reasoning: `Timeline mentioned in the meeting`,
    });
  }

  return suggestions;
}

function extractRapportLearnings(
  analysis: MeetingAnalysis,
  sourceId: string
): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];

  if (!analysis.stakeholders || analysis.stakeholders.length === 0) {
    return suggestions;
  }

  // Extract personal facts as rapport builders
  for (const stakeholder of analysis.stakeholders) {
    if (stakeholder.personalFacts && stakeholder.personalFacts.length > 0) {
      for (const fact of stakeholder.personalFacts) {
        // Personal and interest facts are good rapport builders
        if (fact.type === 'personal' || fact.type === 'interest' || fact.type === 'family') {
          suggestions.push({
            field: 'rapport_builders',
            value: `${stakeholder.name}: ${fact.fact}`,
            source: 'meeting_analysis',
            sourceId,
            confidence: 0.8,
            reasoning: fact.quote ? `Based on quote: "${fact.quote}"` : 'Mentioned in meeting',
          });
        }
      }
    }
  }

  return suggestions;
}

// ============================================
// APPLY UPDATES
// ============================================

async function applyMemoryUpdate(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  suggestion: MemorySuggestion
): Promise<void> {
  // Get or create memory record
  let { data: memory } = await supabase
    .from('account_memory')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!memory) {
    const { data: newMemory, error } = await supabase
      .from('account_memory')
      .insert({ company_id: companyId })
      .select()
      .single();

    if (error) throw error;
    memory = newMemory;
  }

  // Determine update type
  const arrayFields = [
    'resonates', 'effective_angles', 'avoided', 'failed_approaches',
    'key_concerns', 'rapport_builders', 'personal_notes', 'objections_encountered',
  ];

  if (arrayFields.includes(suggestion.field)) {
    // Append to array
    const currentArray = (memory[suggestion.field] as unknown[]) || [];

    // For objections, parse the JSON value
    let newValue: unknown;
    if (suggestion.field === 'objections_encountered') {
      newValue = JSON.parse(suggestion.value);
    } else {
      newValue = suggestion.value;
    }

    // Check for duplicates
    const isDuplicate = currentArray.some(item => {
      if (typeof item === 'string' && typeof newValue === 'string') {
        return item.toLowerCase() === newValue.toLowerCase();
      }
      if (typeof item === 'object' && typeof newValue === 'object') {
        const itemObj = item as { objection?: string };
        const newObj = newValue as { objection?: string };
        return itemObj.objection === newObj.objection;
      }
      return false;
    });

    if (isDuplicate) {
      console.log(`[Memory Capture] Skipping duplicate ${suggestion.field}`);
      return;
    }

    const newArray = [...currentArray, newValue];

    const { error: updateError } = await supabase
      .from('account_memory')
      .update({ [suggestion.field]: newArray })
      .eq('id', memory.id);

    if (updateError) throw updateError;
  } else {
    // Set single value (don't overwrite if already set)
    if (memory[suggestion.field]) {
      console.log(`[Memory Capture] Skipping ${suggestion.field} - already set`);
      return;
    }

    const { error: updateError } = await supabase
      .from('account_memory')
      .update({ [suggestion.field]: suggestion.value })
      .eq('id', memory.id);

    if (updateError) throw updateError;
  }

  // Log the update
  await supabase.from('account_memory_updates').insert({
    account_memory_id: memory.id,
    field_updated: suggestion.field,
    old_value: memory[suggestion.field] || null,
    new_value: suggestion.value,
    source: suggestion.source,
    source_id: suggestion.sourceId,
  });
}

// ============================================
// BATCH APPLY SUGGESTIONS
// ============================================

/**
 * Apply multiple suggestions (for manual approval flow)
 */
export async function applyMemorySuggestions(
  companyId: string,
  suggestions: MemorySuggestion[]
): Promise<{ applied: string[]; errors: string[] }> {
  const supabase = createAdminClient();
  const applied: string[] = [];
  const errors: string[] = [];

  for (const suggestion of suggestions) {
    try {
      await applyMemoryUpdate(supabase, companyId, suggestion);
      applied.push(`${suggestion.field}: ${suggestion.value}`);
    } catch (err) {
      errors.push(`Failed to apply ${suggestion.field}: ${(err as Error).message}`);
    }
  }

  return { applied, errors };
}

// ============================================
// POSTMORTEM CAPTURE
// ============================================

/**
 * Capture learnings from a deal postmortem (win/loss analysis)
 */
export async function capturePostmortemLearnings(
  companyId: string,
  dealId: string,
  outcome: 'won' | 'lost',
  analysis: {
    primaryReason: string;
    whatWorked?: string[];
    whatDidntWork?: string[];
    keyLearnings?: string[];
  }
): Promise<MemoryCaptureResult> {
  const suggestions: MemorySuggestion[] = [];
  const autoApplied: string[] = [];
  const errors: string[] = [];
  const supabase = createAdminClient();

  // Record win/loss theme
  if (outcome === 'won') {
    try {
      await supabase
        .from('account_memory')
        .upsert({
          company_id: companyId,
          last_win_theme: analysis.primaryReason,
        }, { onConflict: 'company_id' });
      autoApplied.push(`last_win_theme: ${analysis.primaryReason}`);
    } catch (err) {
      errors.push(`Failed to set win theme: ${(err as Error).message}`);
    }

    // Add what worked as effective angles
    if (analysis.whatWorked) {
      for (const item of analysis.whatWorked) {
        suggestions.push({
          field: 'effective_angles',
          value: item,
          source: 'postmortem',
          sourceId: dealId,
          confidence: 0.9,
          reasoning: 'This contributed to winning the deal',
        });
      }
    }
  } else {
    try {
      await supabase
        .from('account_memory')
        .upsert({
          company_id: companyId,
          last_loss_reason: analysis.primaryReason,
        }, { onConflict: 'company_id' });
      autoApplied.push(`last_loss_reason: ${analysis.primaryReason}`);
    } catch (err) {
      errors.push(`Failed to set loss reason: ${(err as Error).message}`);
    }

    // Add what didn't work as failed approaches
    if (analysis.whatDidntWork) {
      for (const item of analysis.whatDidntWork) {
        suggestions.push({
          field: 'failed_approaches',
          value: item,
          source: 'postmortem',
          sourceId: dealId,
          confidence: 0.9,
          reasoning: 'This contributed to losing the deal',
        });
      }
    }
  }

  // Add key learnings as personal notes
  if (analysis.keyLearnings) {
    for (const learning of analysis.keyLearnings) {
      suggestions.push({
        field: 'personal_notes',
        value: JSON.stringify({ note: learning, date: new Date().toISOString() }),
        source: 'postmortem',
        sourceId: dealId,
        confidence: 0.85,
        reasoning: 'Key learning from deal postmortem',
      });
    }
  }

  // Apply high-confidence suggestions
  for (const suggestion of suggestions) {
    if (suggestion.confidence >= 0.85) {
      try {
        await applyMemoryUpdate(supabase, companyId, suggestion);
        autoApplied.push(`${suggestion.field}: ${suggestion.value}`);
      } catch (err) {
        errors.push(`Failed to apply ${suggestion.field}: ${(err as Error).message}`);
      }
    }
  }

  return {
    suggestions: suggestions.filter(s => s.confidence < 0.85),
    autoApplied,
    errors,
  };
}
