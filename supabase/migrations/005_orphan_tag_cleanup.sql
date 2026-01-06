-- Migration: Orphan Tag Auto-Cleanup
-- Description: Automatically delete tags that have no associated saves
-- When a save is deleted or tags are removed from a save, any orphaned tags are cleaned up

-- Trigger function to delete orphan tags
CREATE OR REPLACE FUNCTION delete_orphan_tags()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the tag if it has no remaining save associations
    DELETE FROM tags
    WHERE id = OLD.tag_id
    AND NOT EXISTS (
        SELECT 1 FROM save_tags WHERE tag_id = OLD.tag_id
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after each row deletion from save_tags
CREATE TRIGGER trigger_delete_orphan_tags
    AFTER DELETE ON save_tags
    FOR EACH ROW
    EXECUTE FUNCTION delete_orphan_tags();

