-- Migration: Add normalized_url column for duplicate detection
-- This allows detecting duplicate saves even when URLs differ by tracking params
--
-- AFTER running this migration, you MUST backfill existing saves:
--   bun run scripts/backfill-normalized-urls.ts
--
-- This will:
-- 1. Populate normalized_url for all existing saves
-- 2. Report any duplicates that need manual cleanup

-- Add normalized_url column to saves table
ALTER TABLE saves ADD COLUMN IF NOT EXISTS normalized_url TEXT;

-- Create index for fast duplicate lookups within a space
-- Note: NOT using a unique index initially to allow backfill to complete
-- The unique constraint is enforced at the application level
CREATE INDEX IF NOT EXISTS idx_saves_space_normalized_url 
  ON saves(space_id, normalized_url) 
  WHERE normalized_url IS NOT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN saves.normalized_url IS 
  'Normalized URL for duplicate detection. Strips tracking params, normalizes www/protocol, etc.';

