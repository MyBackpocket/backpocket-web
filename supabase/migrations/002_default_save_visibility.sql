-- Add default_save_visibility column to spaces table
-- This allows users to set a default visibility for new saves

ALTER TABLE spaces 
ADD COLUMN IF NOT EXISTS default_save_visibility TEXT NOT NULL 
CHECK (default_save_visibility IN ('private', 'public', 'unlisted')) 
DEFAULT 'private';

-- Add a comment for documentation
COMMENT ON COLUMN spaces.default_save_visibility IS 'Default visibility setting for new saves created in this space';

