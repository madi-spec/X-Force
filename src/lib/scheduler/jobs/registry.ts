/**
 * Scheduler Job Registry
 *
 * Single source of truth for all scheduler cron jobs.
 * Each job has metadata for monitoring, dependencies, and execution requirements.
 */

// ============================================
// JOB DEFINITION TYPES
// ============================================

export interface JobDefinition {
  /** Unique job identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Cron schedule expression */
  schedule: string;
  /** Human-readable schedule description */
  scheduleDescription: string;
  /** Maximum execution time in seconds */
  timeoutSeconds: number;
  /** Whether this job can run in parallel with itself */
  allowConcurrent: boolean;
  /** Jobs that must complete before this one */
  dependencies: string[];
  /** Alert threshold - trigger alert if job takes longer than this (seconds) */
  alertThresholdSeconds: number;
  /** Maximum retries on failure */
  maxRetries: number;
  /** Description of what the job does */
  description: string;
  /** Whether the job is currently enabled */
  enabled: boolean;
}

export interface JobExecutionResult {
  jobId: string;
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  itemsProcessed: number;
  itemsFailed: number;
  errors: string[];
  metadata?: Record<string, unknown>;
}

export interface JobStatus {
  jobId: string;
  lastRun?: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  consecutiveFailures: number;
  isRunning: boolean;
  currentRunStartedAt?: Date;
}

// ============================================
// JOB REGISTRY
// ============================================

export const SCHEDULER_JOBS: Record<string, JobDefinition> = {
  PROCESS_RESPONSES: {
    id: 'scheduler:process-responses',
    name: 'Process Responses',
    schedule: '* * * * *', // Every minute
    scheduleDescription: 'Every minute',
    timeoutSeconds: 60,
    allowConcurrent: false,
    dependencies: [],
    alertThresholdSeconds: 45,
    maxRetries: 3,
    description: 'Process incoming scheduling responses from emails',
    enabled: true,
  },

  SEND_FOLLOW_UPS: {
    id: 'scheduler:send-follow-ups',
    name: 'Send Follow-Ups',
    schedule: '*/15 * * * *', // Every 15 minutes
    scheduleDescription: 'Every 15 minutes',
    timeoutSeconds: 120,
    allowConcurrent: false,
    dependencies: ['scheduler:process-responses'],
    alertThresholdSeconds: 90,
    maxRetries: 2,
    description: 'Send follow-up emails for requests awaiting response',
    enabled: true,
  },

  SEND_REMINDERS: {
    id: 'scheduler:send-reminders',
    name: 'Send Reminders',
    schedule: '0 * * * *', // Every hour
    scheduleDescription: 'Every hour',
    timeoutSeconds: 120,
    allowConcurrent: false,
    dependencies: [],
    alertThresholdSeconds: 90,
    maxRetries: 2,
    description: 'Send meeting reminders 24 hours before scheduled meetings',
    enabled: true,
  },

  CHECK_NO_SHOWS: {
    id: 'scheduler:check-no-shows',
    name: 'Check No-Shows',
    schedule: '*/30 * * * *', // Every 30 minutes
    scheduleDescription: 'Every 30 minutes',
    timeoutSeconds: 60,
    allowConcurrent: false,
    dependencies: [],
    alertThresholdSeconds: 45,
    maxRetries: 2,
    description: 'Detect meetings where attendees did not show up',
    enabled: true,
  },

  EXECUTE_DRAFTS: {
    id: 'scheduler:execute-drafts',
    name: 'Execute Approved Drafts',
    schedule: '* * * * *', // Every minute
    scheduleDescription: 'Every minute',
    timeoutSeconds: 60,
    allowConcurrent: false,
    dependencies: [],
    alertThresholdSeconds: 45,
    maxRetries: 3,
    description: 'Send emails for drafts that have been approved',
    enabled: true,
  },

  EXPIRE_DRAFTS: {
    id: 'scheduler:expire-drafts',
    name: 'Expire Stale Drafts',
    schedule: '0 * * * *', // Every hour
    scheduleDescription: 'Every hour',
    timeoutSeconds: 30,
    allowConcurrent: false,
    dependencies: [],
    alertThresholdSeconds: 20,
    maxRetries: 1,
    description: 'Mark old unapproved drafts as expired',
    enabled: true,
  },

  CLEANUP_STALE_REQUESTS: {
    id: 'scheduler:cleanup-stale',
    name: 'Cleanup Stale Requests',
    schedule: '0 0 * * *', // Daily at midnight
    scheduleDescription: 'Daily at midnight',
    timeoutSeconds: 300,
    allowConcurrent: false,
    dependencies: [],
    alertThresholdSeconds: 240,
    maxRetries: 1,
    description: 'Clean up requests that have been stuck for too long',
    enabled: true,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all enabled jobs
 */
export function getEnabledJobs(): JobDefinition[] {
  return Object.values(SCHEDULER_JOBS).filter((job) => job.enabled);
}

/**
 * Get a job by its ID
 */
export function getJobById(jobId: string): JobDefinition | undefined {
  return Object.values(SCHEDULER_JOBS).find((job) => job.id === jobId);
}

/**
 * Get jobs that can run now (dependencies satisfied)
 */
export function getReadyJobs(completedJobIds: Set<string>): JobDefinition[] {
  return getEnabledJobs().filter((job) =>
    job.dependencies.every((dep) => completedJobIds.has(dep))
  );
}

/**
 * Check if a job should run based on its schedule
 */
export function shouldJobRun(job: JobDefinition, lastRun?: Date): boolean {
  if (!job.enabled) return false;
  if (!lastRun) return true;

  const now = new Date();
  const schedule = job.schedule;

  // Parse cron schedule (simplified - handles common patterns)
  const parts = schedule.split(' ');
  if (parts.length !== 5) return true;

  const [minute, hour] = parts;

  // Every minute
  if (minute === '*' && hour === '*') {
    return now.getTime() - lastRun.getTime() >= 60 * 1000;
  }

  // Every N minutes
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2), 10);
    return now.getTime() - lastRun.getTime() >= interval * 60 * 1000;
  }

  // Every hour
  if (minute === '0' && hour === '*') {
    return now.getTime() - lastRun.getTime() >= 60 * 60 * 1000;
  }

  // Daily at specific time
  if (minute === '0' && hour === '0') {
    return now.getTime() - lastRun.getTime() >= 24 * 60 * 60 * 1000;
  }

  return true;
}

/**
 * Format job result for logging
 */
export function formatJobResult(result: JobExecutionResult): string {
  const status = result.success ? '✓' : '✗';
  const duration = (result.durationMs / 1000).toFixed(2);
  return `[${status}] ${result.jobId}: ${result.itemsProcessed} processed, ${result.itemsFailed} failed (${duration}s)`;
}

/**
 * Check if job execution is healthy
 */
export function isJobHealthy(job: JobDefinition, status: JobStatus): boolean {
  // Job is unhealthy if:
  // 1. More than 3 consecutive failures
  if (status.consecutiveFailures >= 3) return false;

  // 2. Currently running longer than timeout
  if (status.isRunning && status.currentRunStartedAt) {
    const runningFor = (Date.now() - status.currentRunStartedAt.getTime()) / 1000;
    if (runningFor > job.timeoutSeconds) return false;
  }

  // 3. Hasn't run in 2x the expected interval
  if (status.lastRun) {
    const sinceLastRun = (Date.now() - status.lastRun.getTime()) / 1000;
    const expectedInterval = getExpectedIntervalSeconds(job);
    if (sinceLastRun > expectedInterval * 2) return false;
  }

  return true;
}

/**
 * Get expected run interval in seconds based on schedule
 */
function getExpectedIntervalSeconds(job: JobDefinition): number {
  const parts = job.schedule.split(' ');
  const [minute, hour] = parts;

  if (minute === '*' && hour === '*') return 60;
  if (minute.startsWith('*/')) return parseInt(minute.slice(2), 10) * 60;
  if (minute === '0' && hour === '*') return 3600;
  if (minute === '0' && hour === '0') return 86400;

  return 3600; // Default to 1 hour
}
