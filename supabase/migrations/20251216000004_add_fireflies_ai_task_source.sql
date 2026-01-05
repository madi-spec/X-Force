-- Add 'fireflies_ai' to task_source enum for AI-generated review tasks from Fireflies transcripts

ALTER TYPE task_source ADD VALUE IF NOT EXISTS 'fireflies_ai';
