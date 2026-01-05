-- Remove 'unlisted' visibility option
-- Simplify to just 'private' and 'public'

-- Step 1: Convert existing 'unlisted' saves to 'public'
UPDATE saves SET visibility = 'public' WHERE visibility = 'unlisted';

-- Step 2: Convert existing 'unlisted' default_save_visibility to 'public'
UPDATE spaces SET default_save_visibility = 'public' WHERE default_save_visibility = 'unlisted';

-- Step 3: Update the CHECK constraint on saves.visibility
ALTER TABLE saves DROP CONSTRAINT IF EXISTS saves_visibility_check;
ALTER TABLE saves ADD CONSTRAINT saves_visibility_check 
    CHECK (visibility IN ('private', 'public'));

-- Step 4: Update the CHECK constraint on spaces.default_save_visibility
ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_default_save_visibility_check;
ALTER TABLE spaces ADD CONSTRAINT spaces_default_save_visibility_check 
    CHECK (default_save_visibility IN ('private', 'public'));

-- Step 5: Update RLS policies to remove 'unlisted' references
DROP POLICY IF EXISTS "Public saves are viewable by everyone" ON saves;
CREATE POLICY "Public saves are viewable by everyone" ON saves
    FOR SELECT USING (visibility = 'public');

DROP POLICY IF EXISTS "Public snapshots are viewable when save is public" ON save_snapshots;
CREATE POLICY "Public snapshots are viewable when save is public" ON save_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM saves 
            WHERE saves.id = save_snapshots.save_id 
            AND saves.visibility = 'public'
        )
    );

