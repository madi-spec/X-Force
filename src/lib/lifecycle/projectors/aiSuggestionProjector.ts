/**
 * AI Suggestion Projector
 *
 * Projects AI suggestion events into the ai_suggestions_read_model table.
 * This enables querying pending, accepted, and dismissed suggestions.
 *
 * DERIVED FROM EVENTS:
 * - AISuggestionCreated → creates pending suggestion
 * - AISuggestionAccepted → marks suggestion as accepted
 * - AISuggestionDismissed → marks suggestion as dismissed
 *
 * IDEMPOTENCY:
 * - Uses upsert with suggestion_id as key
 * - Same event applied twice produces same result
 *
 * GUARDRAILS:
 * - AI suggestions are READ-ONLY proposals
 * - Only humans can accept/dismiss (enforced in commands)
 * - This projector just reflects the event state
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from './core';
import type { AISuggestionType } from '../events';

// ============================================================================
// EVENT DATA TYPES (for type-safe extraction)
// ============================================================================

interface AISuggestionCreatedEventData {
  suggestionId: string;
  suggestionType: AISuggestionType;
  title: string;
  description: string;
  confidence: number;
  sourceType: 'transcript' | 'email' | 'activity' | 'sla_scan' | 'health_score' | 'manual';
  sourceId?: string;
  suggestedAction: {
    command: string;
    params: Record<string, unknown>;
  };
  expiresAt?: string;
}

interface AISuggestionAcceptedEventData {
  suggestionId: string;
  suggestionType: AISuggestionType;
  modification?: string;
  executeAction: boolean;
}

interface AISuggestionDismissedEventData {
  suggestionId: string;
  suggestionType: AISuggestionType;
  dismissReason?: 'not_relevant' | 'already_done' | 'incorrect' | 'deferred' | 'other';
  feedback?: string;
}

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const AISuggestionProjector: Projector = {
  name: 'ai_suggestions',
  aggregateTypes: ['CompanyProduct'],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    // Only handle AI suggestion events
    if (!event.event_type.startsWith('AISuggestion')) {
      return;
    }

    const aggregateId = event.aggregate_id;
    const eventData = event.event_data as unknown;

    // Fetch company_id and product_id from company_products
    const { data: companyProduct, error: cpError } = await supabase
      .from('company_products')
      .select('company_id, product_id')
      .eq('id', aggregateId)
      .single();

    if (cpError) {
      if (cpError.code === 'PGRST116') {
        console.warn(`CompanyProduct ${aggregateId} not found - skipping event ${event.id}`);
        return;
      }
      throw new Error(`Failed to fetch company_product: ${cpError.message}`);
    }

    switch (event.event_type) {
      case 'AISuggestionCreated': {
        const data = eventData as AISuggestionCreatedEventData;

        const { error } = await supabase
          .from('ai_suggestions_read_model')
          .upsert({
            suggestion_id: data.suggestionId,
            company_product_id: aggregateId,
            company_id: companyProduct.company_id,
            product_id: companyProduct.product_id,
            suggestion_type: data.suggestionType,
            title: data.title,
            description: data.description,
            confidence: data.confidence,
            source_type: data.sourceType,
            source_id: data.sourceId,
            suggested_action: data.suggestedAction,
            status: 'pending',
            created_at: event.occurred_at,
            expires_at: data.expiresAt,
            created_event_id: event.id,
            projected_at: new Date().toISOString(),
          }, {
            onConflict: 'suggestion_id',
          });

        if (error) {
          throw new Error(`Failed to create AI suggestion: ${error.message}`);
        }
        break;
      }

      case 'AISuggestionAccepted': {
        const data = eventData as AISuggestionAcceptedEventData;

        const { error } = await supabase
          .from('ai_suggestions_read_model')
          .update({
            status: 'accepted',
            resolved_at: event.occurred_at,
            resolved_by_actor_type: event.actor_type,
            resolved_by_actor_id: event.actor_id,
            resolution_notes: data.modification,
            resolved_event_id: event.id,
            projected_at: new Date().toISOString(),
          })
          .eq('suggestion_id', data.suggestionId);

        if (error) {
          throw new Error(`Failed to accept AI suggestion: ${error.message}`);
        }
        break;
      }

      case 'AISuggestionDismissed': {
        const data = eventData as AISuggestionDismissedEventData;

        const { error } = await supabase
          .from('ai_suggestions_read_model')
          .update({
            status: 'dismissed',
            resolved_at: event.occurred_at,
            resolved_by_actor_type: event.actor_type,
            resolved_by_actor_id: event.actor_id,
            dismiss_reason: data.dismissReason,
            resolution_notes: data.feedback,
            resolved_event_id: event.id,
            projected_at: new Date().toISOString(),
          })
          .eq('suggestion_id', data.suggestionId);

        if (error) {
          throw new Error(`Failed to dismiss AI suggestion: ${error.message}`);
        }
        break;
      }

      default:
        // Unknown AI suggestion event - log but don't fail
        console.warn(`Unknown AI suggestion event type: ${event.event_type}`);
    }
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    // Delete all AI suggestions for rebuild
    const { error } = await supabase
      .from('ai_suggestions_read_model')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to clear AI suggestions: ${error.message}`);
    }
  },
};
