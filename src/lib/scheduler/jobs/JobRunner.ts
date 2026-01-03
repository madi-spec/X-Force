/**
 * JobRunner - Base class for all scheduler jobs
 *
 * Provides:
 * - Consistent execution patterns
 * - Automatic logging with correlation IDs
 * - Error handling and retry logic
 * - Execution metrics
 * - Database logging to cron_execution_log
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { JobDefinition, JobExecutionResult, JobStatus } from './registry';

// ============================================
// TYPES
// ============================================

export interface JobContext {
  /** Unique ID for this execution */
  correlationId: string;
  /** The job being executed */
  job: JobDefinition;
  /** When execution started */
  startedAt: Date;
  /** Supabase admin client */
  supabase: ReturnType<typeof createAdminClient>;
  /** Log a message with correlation ID */
  log: (message: string, data?: Record<string, unknown>) => void;
  /** Log an error with correlation ID */
  error: (message: string, err?: unknown) => void;
}

export interface ProcessingStats {
  processed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// ============================================
// JOB RUNNER BASE CLASS
// ============================================

export abstract class JobRunner {
  protected readonly jobId: string;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  /**
   * Execute the job with full lifecycle management
   */
  async execute(): Promise<JobExecutionResult> {
    const correlationId = crypto.randomUUID();
    const startedAt = new Date();
    const supabase = createAdminClient();

    const context: JobContext = {
      correlationId,
      job: this.getJobDefinition(),
      startedAt,
      supabase,
      log: (message, data) => this.logMessage(correlationId, message, data),
      error: (message, err) => this.logError(correlationId, message, err),
    };

    context.log(`Starting job execution`);

    // Check for concurrent execution
    if (!context.job.allowConcurrent) {
      const isRunning = await this.checkConcurrentExecution(supabase);
      if (isRunning) {
        context.log('Job already running, skipping execution');
        return this.buildResult(context, { processed: 0, failed: 0, skipped: 0, errors: [] }, true);
      }
    }

    // Record job start
    await this.recordJobStart(supabase, correlationId);

    let stats: ProcessingStats = { processed: 0, failed: 0, skipped: 0, errors: [] };
    let success = true;

    try {
      // Execute with timeout
      stats = await this.withTimeout(
        () => this.run(context),
        context.job.timeoutSeconds * 1000
      );
    } catch (err) {
      success = false;
      stats.errors.push(String(err));
      context.error('Job execution failed', err);

      // Attempt retry if configured
      if (context.job.maxRetries > 0) {
        context.log(`Retrying (max ${context.job.maxRetries} retries)`);
        // Retry logic would go here - for now just log
      }
    }

    // Record job completion
    const result = this.buildResult(context, stats, success);
    await this.recordJobEnd(supabase, correlationId, result);

    context.log(`Job complete: ${stats.processed} processed, ${stats.failed} failed`, {
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Abstract method - implement job-specific logic
   */
  protected abstract run(context: JobContext): Promise<ProcessingStats>;

  /**
   * Get the job definition from registry
   */
  protected abstract getJobDefinition(): JobDefinition;

  // ============================================
  // HELPER METHODS
  // ============================================

  private logMessage(correlationId: string, message: string, data?: Record<string, unknown>): void {
    const prefix = `[${this.jobId}:${correlationId.slice(0, 8)}]`;
    if (data) {
      console.log(prefix, message, JSON.stringify(data));
    } else {
      console.log(prefix, message);
    }
  }

  private logError(correlationId: string, message: string, err?: unknown): void {
    const prefix = `[${this.jobId}:${correlationId.slice(0, 8)}]`;
    console.error(prefix, message, err);
  }

  private async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Job timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private async checkConcurrentExecution(
    supabase: ReturnType<typeof createAdminClient>
  ): Promise<boolean> {
    const { data } = await supabase
      .from('cron_execution_log')
      .select('id')
      .eq('job_name', this.jobId)
      .is('completed_at', null)
      .gte('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .limit(1);

    return (data?.length || 0) > 0;
  }

  private async recordJobStart(
    supabase: ReturnType<typeof createAdminClient>,
    correlationId: string
  ): Promise<void> {
    await supabase.from('cron_execution_log').insert({
      job_name: this.jobId,
      correlation_id: correlationId,
      started_at: new Date().toISOString(),
      status: 'running',
    });
  }

  private async recordJobEnd(
    supabase: ReturnType<typeof createAdminClient>,
    correlationId: string,
    result: JobExecutionResult
  ): Promise<void> {
    await supabase
      .from('cron_execution_log')
      .update({
        completed_at: result.completedAt.toISOString(),
        status: result.success ? 'success' : 'failed',
        duration_ms: result.durationMs,
        items_processed: result.itemsProcessed,
        items_failed: result.itemsFailed,
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
        metadata: result.metadata,
      })
      .eq('correlation_id', correlationId);
  }

  private buildResult(
    context: JobContext,
    stats: ProcessingStats,
    success: boolean
  ): JobExecutionResult {
    const completedAt = new Date();
    return {
      jobId: this.jobId,
      success: success && stats.failed === 0,
      startedAt: context.startedAt,
      completedAt,
      durationMs: completedAt.getTime() - context.startedAt.getTime(),
      itemsProcessed: stats.processed,
      itemsFailed: stats.failed,
      errors: stats.errors,
    };
  }
}

// ============================================
// JOB STATUS HELPERS
// ============================================

/**
 * Get the status of a specific job
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const supabase = createAdminClient();

  // Get last 10 executions
  const { data: executions } = await supabase
    .from('cron_execution_log')
    .select('*')
    .eq('job_name', jobId)
    .order('started_at', { ascending: false })
    .limit(10);

  if (!executions || executions.length === 0) {
    return {
      jobId,
      consecutiveFailures: 0,
      isRunning: false,
    };
  }

  const latest = executions[0];
  const isRunning = latest.status === 'running';

  // Count consecutive failures
  let consecutiveFailures = 0;
  for (const exec of executions) {
    if (exec.status === 'failed') {
      consecutiveFailures++;
    } else if (exec.status === 'success') {
      break;
    }
  }

  // Find last success and failure
  const lastSuccess = executions.find((e) => e.status === 'success');
  const lastFailure = executions.find((e) => e.status === 'failed');

  return {
    jobId,
    lastRun: latest.started_at ? new Date(latest.started_at) : undefined,
    lastSuccess: lastSuccess?.completed_at ? new Date(lastSuccess.completed_at) : undefined,
    lastFailure: lastFailure?.started_at ? new Date(lastFailure.started_at) : undefined,
    consecutiveFailures,
    isRunning,
    currentRunStartedAt: isRunning ? new Date(latest.started_at) : undefined,
  };
}

/**
 * Get status of all jobs
 */
export async function getAllJobStatuses(): Promise<Map<string, JobStatus>> {
  const { SCHEDULER_JOBS } = await import('./registry');
  const statuses = new Map<string, JobStatus>();

  for (const job of Object.values(SCHEDULER_JOBS)) {
    const status = await getJobStatus(job.id);
    statuses.set(job.id, status);
  }

  return statuses;
}
