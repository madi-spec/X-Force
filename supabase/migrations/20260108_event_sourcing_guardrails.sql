-- Event Sourcing Guardrails Migration
-- Adds support for deterministic projection rebuilds and observability

-- Function to safely truncate a projection table
-- Only allows truncation of known projection tables
CREATE OR REPLACE FUNCTION truncate_projection_table(table_name TEXT)
RETURNS VOID AS $$
DECLARE
  allowed_tables TEXT[] := ARRAY[
    'support_case_read_model',
    'support_case_sla_facts',
    'company_product_read_model',
    'company_product_stage_facts',
    'company_product_open_case_counts',
    'company_open_case_counts',
    'product_pipeline_stage_counts'
  ];
BEGIN
  -- Verify table is in allowed list
  IF NOT (table_name = ANY(allowed_tables)) THEN
    RAISE EXCEPTION 'Cannot truncate table %. Only projection tables are allowed.', table_name;
  END IF;

  -- Execute the truncate
  EXECUTE format('DELETE FROM %I WHERE true', table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (admin check is done in API)
GRANT EXECUTE ON FUNCTION truncate_projection_table(TEXT) TO authenticated;

-- Function to get projection lag for all projectors
CREATE OR REPLACE FUNCTION get_projection_lag()
RETURNS TABLE (
  projector_name TEXT,
  last_processed_sequence BIGINT,
  current_max_sequence BIGINT,
  lag_events BIGINT,
  status TEXT,
  last_processed_at TIMESTAMPTZ
) AS $$
DECLARE
  max_seq BIGINT;
BEGIN
  -- Get the current max global sequence
  SELECT COALESCE(MAX(global_sequence), 0) INTO max_seq FROM event_store;

  RETURN QUERY
  SELECT
    pc.projector_name,
    COALESCE(pc.last_processed_global_sequence, 0) as last_processed_sequence,
    max_seq as current_max_sequence,
    max_seq - COALESCE(pc.last_processed_global_sequence, 0) as lag_events,
    pc.status,
    pc.last_processed_at
  FROM projector_checkpoints pc
  ORDER BY pc.projector_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_projection_lag() TO authenticated;

-- Function to reset a projector checkpoint (for rebuilds)
CREATE OR REPLACE FUNCTION reset_projector_checkpoint(p_projector_name TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE projector_checkpoints
  SET
    last_processed_global_sequence = 0,
    last_processed_event_id = NULL,
    last_processed_at = NULL,
    events_processed_count = 0,
    errors_count = 0,
    last_error = NULL,
    last_error_at = NULL,
    status = 'rebuilding',
    updated_at = NOW()
  WHERE projector_name = p_projector_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projector % not found', p_projector_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION reset_projector_checkpoint(TEXT) TO authenticated;

-- Add index for efficient event fetching during replay
CREATE INDEX IF NOT EXISTS idx_event_store_global_sequence_replay
  ON event_store (global_sequence ASC)
  WHERE global_sequence > 0;

-- Add index for aggregate event lookup
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate_lookup
  ON event_store (aggregate_type, aggregate_id, sequence_number ASC);

-- View for projection health monitoring
CREATE OR REPLACE VIEW projection_health AS
SELECT
  pc.projector_name,
  pc.status,
  pc.last_processed_global_sequence,
  pc.events_processed_count,
  pc.errors_count,
  pc.last_error,
  pc.last_processed_at,
  pc.updated_at,
  (SELECT MAX(global_sequence) FROM event_store) - COALESCE(pc.last_processed_global_sequence, 0) as lag_events,
  CASE
    WHEN pc.status = 'error' THEN 'critical'
    WHEN pc.errors_count > 10 THEN 'warning'
    WHEN (SELECT MAX(global_sequence) FROM event_store) - COALESCE(pc.last_processed_global_sequence, 0) > 1000 THEN 'warning'
    ELSE 'healthy'
  END as health_status
FROM projector_checkpoints pc;

-- Grant select on the view
GRANT SELECT ON projection_health TO authenticated;

-- Trigger to prevent direct writes to projection tables from non-service-role connections
-- This adds an extra layer of protection beyond the application guardrails
CREATE OR REPLACE FUNCTION check_projection_write_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service role (used by projectors)
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow during explicit rebuild mode (set by admin API)
  IF current_setting('app.rebuild_mode', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- For now, allow all writes (the application-level guardrails handle this)
  -- Uncomment to enforce at DB level:
  -- RAISE EXCEPTION 'Direct writes to projection tables are not allowed. Use command handlers.';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: To enable strict DB-level enforcement, create triggers on each projection table:
-- CREATE TRIGGER enforce_projection_write_guard
--   BEFORE INSERT OR UPDATE OR DELETE ON support_case_read_model
--   FOR EACH ROW EXECUTE FUNCTION check_projection_write_allowed();

COMMENT ON FUNCTION truncate_projection_table(TEXT) IS
  'Safely truncates a projection table for rebuilds. Only allows known projection tables.';

COMMENT ON FUNCTION get_projection_lag() IS
  'Returns the current lag (unprocessed events) for each projector.';

COMMENT ON FUNCTION reset_projector_checkpoint(TEXT) IS
  'Resets a projector checkpoint to zero for rebuild. Sets status to rebuilding.';

COMMENT ON VIEW projection_health IS
  'Monitoring view showing health status of all projectors including lag and error counts.';
