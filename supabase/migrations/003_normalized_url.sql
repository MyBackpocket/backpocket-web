-- Migration: Add normalized_url column for duplicate detection
-- This allows detecting duplicate saves even when URLs differ by tracking params

-- Add normalized_url column to saves table
ALTER TABLE saves ADD COLUMN IF NOT EXISTS normalized_url TEXT;

-- Create index for fast duplicate lookups within a space
-- Using a unique index to enforce no duplicates per space
CREATE UNIQUE INDEX IF NOT EXISTS idx_saves_space_normalized_url 
  ON saves(space_id, normalized_url) 
  WHERE normalized_url IS NOT NULL;

-- Note: We don't backfill existing rows here because URL normalization
-- requires application logic. Run the backfill script separately:
--
--   bun run scripts/backfill-normalized-urls.ts
--
-- Or update normalized_url when saves are next edited/viewed.

-- Add a comment to document the column
COMMENT ON COLUMN saves.normalized_url IS 
  'Normalized URL for duplicate detection. Strips tracking params, normalizes www/protocol, etc.';

