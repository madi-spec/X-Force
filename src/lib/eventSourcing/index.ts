/**
 * Event Sourcing Infrastructure
 *
 * Central module for event sourcing utilities:
 * - Guardrails: Enforce architectural rules
 * - Observability: Structured logging and metrics
 * - Rebuild: Deterministic projection rebuilding
 * - Registry: Projector lookup
 */

// Guardrails
export {
  PROJECTION_TABLES,
  AUTHORITATIVE_TABLES,
  assertNotProjectionWrite,
  ProjectionWriteViolationError,
  createReadOnlyProjectionsClient,
  isProjectorFile,
  findProjectionWriteViolations,
  withProjectionGuard,
  type ProjectionTable,
  type ProjectionWriteViolation,
} from './guardrails';

// Observability
export {
  esLogger,
  trackCommandExecution,
  trackEventAppended,
  trackProjectorRun,
  trackSlaBreachDetected,
  trackRebuildStarted,
  trackRebuildProgress,
  trackRebuildCompleted,
  trackGuardrailViolation,
  getMetricsSnapshot,
  getRecentLogs,
  resetMetrics,
  getProjectionLagSummary,
  exportPrometheusMetrics,
  type LogLevel,
  type StructuredLogEntry,
} from './observability';

// Rebuild
export {
  ALL_PROJECTORS,
  rebuildProjections,
  takeProjectionSnapshot,
  compareSnapshots,
  verifyRebuildDeterminism,
  type ProjectorName,
  type RebuildOptions,
  type RebuildResult,
  type ProjectionSnapshot,
} from './rebuild';

// Registry
export {
  getProjectorByName,
  getAllProjectors,
  getProjectorNames,
  registerProjector,
  clearRegistry,
} from './projectorRegistry';
