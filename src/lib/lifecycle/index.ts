/**
 * Lifecycle Engine
 *
 * Event-sourced lifecycle management for CompanyProduct aggregates.
 *
 * EXPORTS:
 * - Events: Type definitions for all lifecycle events
 * - Aggregate: State computation via event replay
 * - Commands: Command handlers for state changes
 * - Projectors: Read model projection from events
 */

// Event types and builders
export * from './events';

// Aggregate state and replay
export * from './aggregate';

// Command handlers
export * from './commands';

// Projectors (re-export key functions)
export {
  // Core
  runProjector,
  rebuildProjector,
  getCheckpoint,
  // Runner
  runAllProjectors,
  runAllProjectorsToCompletion,
  rebuildAllProjectors,
  runProjectorByName,
  rebuildProjectorByName,
  getProjectorStatuses,
  getProjectorLag,
  // Projector instances
  PROJECTORS,
  PROJECTOR_MAP,
  CompanyProductReadModelProjector,
  CompanyProductStageFactsProjector,
  ProductPipelineStageCountsProjector,
} from './projectors';
