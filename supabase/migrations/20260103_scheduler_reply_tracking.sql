-- Add last_inbound_message_id to track which email to reply to
-- This enables proper email threading by using Microsoft Graph's createReply API

ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS last_inbound_message_id TEXT;

COMMENT ON COLUMN scheduling_requests.last_inbound_message_id IS
  'Microsoft Graph messageId of the last inbound email from the prospect. Used to reply to the correct message and maintain email thread history.';
