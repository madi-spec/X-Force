-- Cron Execution Logging
-- Provides observability into when cron jobs run and their outcomes

CREATE TABLE IF NOT EXISTS cron_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,              -- e.g., 'sync-microsoft', 'sync-fireflies'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'error'
  duration_ms INTEGER,
  result JSONB,                         -- Summary of what was done
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent executions
CREATE INDEX idx_cron_executions_job_started ON cron_executions(job_name, started_at DESC);
CREATE INDEX idx_cron_executions_status ON cron_executions(status, started_at DESC);

-- Clean up old entries (keep 7 days)
-- This can be called periodically or via a separate cleanup cron
CREATE OR REPLACE FUNCTION cleanup_old_cron_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cron_executions
  WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant access
GRANT ALL ON cron_executions TO authenticated;
GRANT ALL ON cron_executions TO service_role;
