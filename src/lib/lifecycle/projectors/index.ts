/**
 * Lifecycle Projectors
 *
 * Event projectors that derive read models from the event store.
 *
 * EXPORTS:
 * - Core: Projector infrastructure, checkpoint management
 * - ReadModelProjector: Current state snapshot
 * - StageFactsProjector: Stage duration analytics
 * - PipelineCountsProjector: Kanban aggregates
 * - AISuggestionProjector: AI suggestion read model
 * - Runner: Unified projector orchestration
 */

// Core infrastructure
export * from './core';

// Individual projectors
export { CompanyProductReadModelProjector } from './readModelProjector';
export { CompanyProductStageFactsProjector } from './stageFactsProjector';
export { ProductPipelineStageCountsProjector, rebuildPipelineCounts, rebuildProductPipelineCounts } from './pipelineCountsProjector';
export { AISuggestionProjector } from './aiSuggestionProjector';
export { SLABreachFactsProjector } from './slaBreachProjector';

// Unified runner
export * from './runner';
