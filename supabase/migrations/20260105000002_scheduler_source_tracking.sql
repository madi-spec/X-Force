-- Add source tracking to scheduling_requests
-- Allows linking back to the originating communication/email

ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS source_communication_id UUID REFERENCES communications(id) ON DELETE SET NULL;

-- Index for looking up scheduling requests by source
CREATE INDEX IF NOT EXISTS idx_scheduling_requests_source_comm
ON scheduling_requests(source_communication_id)
WHERE source_communication_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN scheduling_requests.source_communication_id IS 'The communication/email that triggered this scheduling request (for Daily Driver integration)';
