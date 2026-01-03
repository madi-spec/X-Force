/**
 * Cron Execution Logging
 *
 * Provides observability into cron job executions.
 * Logs start, completion, and errors to the cron_executions table.
 */

import { createAdminClient } from '@/lib/supabase/admin';

interface CronLogEntry {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'error';
  duration_ms: number | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
}

/**
 * Start logging a cron execution
 * Returns an ID that should be used to mark completion
 */
export async function logCronStart(jobName: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cron_executions')
      .insert({
        job_name: jobName,
        status: 'running',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[Cron/${jobName}] Failed to log start:`, error.message);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error(`[Cron/${jobName}] Failed to log start:`, err);
    return null;
  }
}

/**
 * Mark a cron execution as completed successfully
 */
export async function logCronSuccess(
  executionId: string | null,
  jobName: string,
  startTime: number,
  result?: Record<string, unknown>
): Promise<void> {
  const durationMs = Date.now() - startTime;

  console.log(`[Cron/${jobName}] Completed successfully in ${durationMs}ms`);

  if (!executionId) return;

  try {
    const supabase = createAdminClient();
    await supabase
      .from('cron_executions')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        result: result || null,
      })
      .eq('id', executionId);
  } catch (err) {
    console.error(`[Cron/${jobName}] Failed to log success:`, err);
  }
}

/**
 * Mark a cron execution as failed
 */
export async function logCronError(
  executionId: string | null,
  jobName: string,
  startTime: number,
  error: unknown
): Promise<void> {
  const durationMs = Date.now() - startTime;
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error(`[Cron/${jobName}] Failed after ${durationMs}ms:`, errorMessage);

  if (!executionId) return;

  try {
    const supabase = createAdminClient();
    await supabase
      .from('cron_executions')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        error_message: errorMessage,
      })
      .eq('id', executionId);
  } catch (err) {
    console.error(`[Cron/${jobName}] Failed to log error:`, err);
  }
}

/**
 * Get recent cron executions
 */
export async function getRecentExecutions(
  jobName?: string,
  limit: number = 20
): Promise<CronLogEntry[]> {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from('cron_executions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (jobName) {
      query = query.eq('job_name', jobName);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch cron executions:', error.message);
      return [];
    }

    return data as CronLogEntry[];
  } catch (err) {
    console.error('Failed to fetch cron executions:', err);
    return [];
  }
}

/**
 * Wrapper to execute a cron job with automatic logging
 */
export async function withCronLogging<T>(
  jobName: string,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const executionId = await logCronStart(jobName);

  try {
    const result = await handler();
    await logCronSuccess(
      executionId,
      jobName,
      startTime,
      typeof result === 'object' ? (result as Record<string, unknown>) : { result }
    );
    return result;
  } catch (error) {
    await logCronError(executionId, jobName, startTime, error);
    throw error;
  }
}
