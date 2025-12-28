/**
 * Event Sourcing Observability
 *
 * Structured logging and metrics for:
 * - Command handling
 * - Event processing
 * - Projector execution
 * - SLA breach detection
 */

// Metrics counters (in-memory, can be exported to external systems)
const metrics = {
  commands: {
    executed: 0,
    succeeded: 0,
    failed: 0,
    byType: new Map<string, number>(),
  },
  events: {
    appended: 0,
    processed: 0,
    byType: new Map<string, number>(),
  },
  projectors: {
    runs: 0,
    eventsProcessed: 0,
    errors: 0,
    byProjector: new Map<string, ProjectorMetrics>(),
  },
  sla: {
    breachesDetected: 0,
    breachesByType: new Map<string, number>(),
  },
};

interface ProjectorMetrics {
  runs: number;
  eventsProcessed: number;
  errors: number;
  lastRunAt: Date | null;
  lastDurationMs: number;
  avgDurationMs: number;
  lagEvents: number;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  category: 'command' | 'event' | 'projector' | 'sla' | 'rebuild' | 'guardrail';
  message: string;
  data?: Record<string, unknown>;
  correlationId?: string;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Log buffer for recent entries (circular buffer)
const LOG_BUFFER_SIZE = 1000;
const logBuffer: StructuredLogEntry[] = [];

/**
 * Structured logger for event sourcing operations
 */
export const esLogger = {
  debug: (category: StructuredLogEntry['category'], message: string, data?: Record<string, unknown>) =>
    log('debug', category, message, data),
  info: (category: StructuredLogEntry['category'], message: string, data?: Record<string, unknown>) =>
    log('info', category, message, data),
  warn: (category: StructuredLogEntry['category'], message: string, data?: Record<string, unknown>) =>
    log('warn', category, message, data),
  error: (category: StructuredLogEntry['category'], message: string, error?: Error, data?: Record<string, unknown>) =>
    logError('error', category, message, error, data),
};

function log(
  level: LogLevel,
  category: StructuredLogEntry['category'],
  message: string,
  data?: Record<string, unknown>
): void {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data,
  };

  addToBuffer(entry);
  outputLog(entry);
}

function logError(
  level: LogLevel,
  category: StructuredLogEntry['category'],
  message: string,
  error?: Error,
  data?: Record<string, unknown>
): void {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined,
  };

  addToBuffer(entry);
  outputLog(entry);
}

function addToBuffer(entry: StructuredLogEntry): void {
  if (logBuffer.length >= LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  logBuffer.push(entry);
}

function outputLog(entry: StructuredLogEntry): void {
  const prefix = `[ES:${entry.category.toUpperCase()}]`;
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  const errorStr = entry.error ? ` | Error: ${entry.error.message}` : '';

  const logLine = `${prefix} ${entry.message}${dataStr}${errorStr}`;

  switch (entry.level) {
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(logLine);
      }
      break;
    case 'info':
      console.log(logLine);
      break;
    case 'warn':
      console.warn(logLine);
      break;
    case 'error':
      console.error(logLine);
      break;
  }
}

/**
 * Command execution tracking
 */
export function trackCommandExecution(
  commandType: string,
  aggregateId: string,
  success: boolean,
  durationMs: number,
  error?: Error
): void {
  metrics.commands.executed++;
  if (success) {
    metrics.commands.succeeded++;
  } else {
    metrics.commands.failed++;
  }

  const count = metrics.commands.byType.get(commandType) || 0;
  metrics.commands.byType.set(commandType, count + 1);

  esLogger.info('command', `Command ${commandType} ${success ? 'succeeded' : 'failed'}`, {
    commandType,
    aggregateId,
    success,
    durationMs,
    error: error?.message,
  });
}

/**
 * Event append tracking
 */
export function trackEventAppended(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  eventId: string,
  sequenceNumber: number
): void {
  metrics.events.appended++;

  const count = metrics.events.byType.get(eventType) || 0;
  metrics.events.byType.set(eventType, count + 1);

  esLogger.debug('event', `Event appended: ${eventType}`, {
    eventType,
    aggregateType,
    aggregateId,
    eventId,
    sequenceNumber,
  });
}

/**
 * Projector run tracking
 */
export function trackProjectorRun(
  projectorName: string,
  eventsProcessed: number,
  durationMs: number,
  errors: number,
  lastSequence: number,
  lagEvents: number
): void {
  metrics.projectors.runs++;
  metrics.projectors.eventsProcessed += eventsProcessed;
  metrics.projectors.errors += errors;

  let projectorMetrics = metrics.projectors.byProjector.get(projectorName);
  if (!projectorMetrics) {
    projectorMetrics = {
      runs: 0,
      eventsProcessed: 0,
      errors: 0,
      lastRunAt: null,
      lastDurationMs: 0,
      avgDurationMs: 0,
      lagEvents: 0,
    };
    metrics.projectors.byProjector.set(projectorName, projectorMetrics);
  }

  const prevAvg = projectorMetrics.avgDurationMs;
  const prevRuns = projectorMetrics.runs;

  projectorMetrics.runs++;
  projectorMetrics.eventsProcessed += eventsProcessed;
  projectorMetrics.errors += errors;
  projectorMetrics.lastRunAt = new Date();
  projectorMetrics.lastDurationMs = durationMs;
  projectorMetrics.avgDurationMs = (prevAvg * prevRuns + durationMs) / projectorMetrics.runs;
  projectorMetrics.lagEvents = lagEvents;

  const level = errors > 0 ? 'warn' : eventsProcessed > 0 ? 'info' : 'debug';
  esLogger[level]('projector', `Projector ${projectorName} completed`, {
    projectorName,
    eventsProcessed,
    durationMs,
    errors,
    lastSequence,
    lagEvents,
  });
}

/**
 * SLA breach tracking
 */
export function trackSlaBreachDetected(
  supportCaseId: string,
  slaType: 'first_response' | 'resolution',
  severity: string,
  hoursOverdue: number
): void {
  metrics.sla.breachesDetected++;

  const key = `${slaType}:${severity}`;
  const count = metrics.sla.breachesByType.get(key) || 0;
  metrics.sla.breachesByType.set(key, count + 1);

  esLogger.warn('sla', `SLA breach detected: ${slaType}`, {
    supportCaseId,
    slaType,
    severity,
    hoursOverdue,
  });
}

/**
 * Rebuild tracking
 */
export function trackRebuildStarted(projectors: string[]): void {
  esLogger.info('rebuild', 'Projection rebuild started', {
    projectors,
    projectorCount: projectors.length,
  });
}

export function trackRebuildProgress(
  projectorName: string,
  eventsProcessed: number,
  totalEvents: number,
  durationMs: number
): void {
  const progress = totalEvents > 0 ? Math.round((eventsProcessed / totalEvents) * 100) : 0;

  esLogger.info('rebuild', `Rebuild progress: ${projectorName}`, {
    projectorName,
    eventsProcessed,
    totalEvents,
    progress: `${progress}%`,
    durationMs,
  });
}

export function trackRebuildCompleted(
  projectors: string[],
  totalEvents: number,
  durationMs: number,
  success: boolean,
  error?: Error
): void {
  if (success) {
    esLogger.info('rebuild', 'Projection rebuild completed successfully', {
      projectors,
      totalEvents,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
    });
  } else {
    esLogger.error('rebuild', 'Projection rebuild failed', error, {
      projectors,
      totalEvents,
      durationMs,
    });
  }
}

/**
 * Guardrail violation tracking
 */
export function trackGuardrailViolation(
  violationType: 'projection_write' | 'direct_mutation',
  table: string,
  context: string,
  filePath?: string
): void {
  esLogger.error('guardrail', `Guardrail violation: ${violationType}`, undefined, {
    violationType,
    table,
    context,
    filePath,
  });
}

/**
 * Get current metrics snapshot
 */
export function getMetricsSnapshot(): typeof metrics {
  return {
    commands: {
      ...metrics.commands,
      byType: new Map(metrics.commands.byType),
    },
    events: {
      ...metrics.events,
      byType: new Map(metrics.events.byType),
    },
    projectors: {
      ...metrics.projectors,
      byProjector: new Map(metrics.projectors.byProjector),
    },
    sla: {
      ...metrics.sla,
      breachesByType: new Map(metrics.sla.breachesByType),
    },
  };
}

/**
 * Get recent log entries
 */
export function getRecentLogs(count: number = 100, category?: StructuredLogEntry['category']): StructuredLogEntry[] {
  let entries = [...logBuffer];

  if (category) {
    entries = entries.filter(e => e.category === category);
  }

  return entries.slice(-count);
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  metrics.commands.executed = 0;
  metrics.commands.succeeded = 0;
  metrics.commands.failed = 0;
  metrics.commands.byType.clear();

  metrics.events.appended = 0;
  metrics.events.processed = 0;
  metrics.events.byType.clear();

  metrics.projectors.runs = 0;
  metrics.projectors.eventsProcessed = 0;
  metrics.projectors.errors = 0;
  metrics.projectors.byProjector.clear();

  metrics.sla.breachesDetected = 0;
  metrics.sla.breachesByType.clear();

  logBuffer.length = 0;
}

/**
 * Get projection lag summary (events pending for each projector)
 */
export function getProjectionLagSummary(): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [name, m] of metrics.projectors.byProjector) {
    result[name] = m.lagEvents;
  }

  return result;
}

/**
 * Export metrics in Prometheus format (for monitoring systems)
 */
export function exportPrometheusMetrics(): string {
  const lines: string[] = [];

  // Commands
  lines.push('# HELP es_commands_total Total commands executed');
  lines.push('# TYPE es_commands_total counter');
  lines.push(`es_commands_total{status="succeeded"} ${metrics.commands.succeeded}`);
  lines.push(`es_commands_total{status="failed"} ${metrics.commands.failed}`);

  // Events
  lines.push('# HELP es_events_appended_total Total events appended');
  lines.push('# TYPE es_events_appended_total counter');
  lines.push(`es_events_appended_total ${metrics.events.appended}`);

  // Projector runs
  lines.push('# HELP es_projector_runs_total Total projector runs');
  lines.push('# TYPE es_projector_runs_total counter');
  lines.push(`es_projector_runs_total ${metrics.projectors.runs}`);

  // Projector lag
  lines.push('# HELP es_projector_lag_events Current event lag per projector');
  lines.push('# TYPE es_projector_lag_events gauge');
  for (const [name, m] of metrics.projectors.byProjector) {
    lines.push(`es_projector_lag_events{projector="${name}"} ${m.lagEvents}`);
  }

  // SLA breaches
  lines.push('# HELP es_sla_breaches_total Total SLA breaches detected');
  lines.push('# TYPE es_sla_breaches_total counter');
  lines.push(`es_sla_breaches_total ${metrics.sla.breachesDetected}`);

  return lines.join('\n');
}
