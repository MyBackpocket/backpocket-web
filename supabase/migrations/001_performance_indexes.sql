-- Performance Indexes Migration
-- Run this on existing databases to add performance-optimized indexes
-- These indexes improve query performance for common operations

-- =============================================================================
-- MEMBERSHIP INDEXES
-- =============================================================================

-- Composite index for auth lookup (user's active memberships)
CREATE INDEX IF NOT EXISTS idx_memberships_user_status 
  ON memberships(user_id, status) 
  WHERE status = 'active';

-- =============================================================================
-- SAVES LISTING INDEXES
-- =============================================================================

-- Main listing query: space + sorted by saved_at
CREATE INDEX IF NOT EXISTS idx_saves_space_saved_at 
  ON saves(space_id, saved_at DESC);

-- Filtered queries with visibility
CREATE INDEX IF NOT EXISTS idx_saves_space_visibility_saved_at 
  ON saves(space_id, visibility, saved_at DESC);

-- Favorites filter (partial index for better performance)
CREATE INDEX IF NOT EXISTS idx_saves_space_favorite_saved_at 
  ON saves(space_id, is_favorite, saved_at DESC) 
  WHERE is_favorite = true;

-- Archived filter
CREATE INDEX IF NOT EXISTS idx_saves_space_archived_saved_at 
  ON saves(space_id, is_archived, saved_at DESC);

-- =============================================================================
-- JUNCTION TABLE INDEXES (critical for tag/collection filtering)
-- =============================================================================

-- Index on tag_id for "find all saves with this tag" queries
CREATE INDEX IF NOT EXISTS idx_save_tags_tag_id 
  ON save_tags(tag_id);

-- Covering index for tag filter joins
CREATE INDEX IF NOT EXISTS idx_save_tags_tag_save 
  ON save_tags(tag_id, save_id);

-- Index on collection_id for "find all saves in this collection" queries
CREATE INDEX IF NOT EXISTS idx_save_collections_collection_id 
  ON save_collections(collection_id);

-- Covering index for collection filter joins
CREATE INDEX IF NOT EXISTS idx_save_collections_collection_save 
  ON save_collections(collection_id, save_id);

-- =============================================================================
-- OTHER INDEXES
-- =============================================================================

-- Domain mappings by space (for admin queries)
CREATE INDEX IF NOT EXISTS idx_domain_mappings_space_id 
  ON domain_mappings(space_id);

-- =============================================================================
-- OPTIONAL: SEARCH OPTIMIZATION
-- =============================================================================
-- Uncomment these lines if you want faster ILIKE searches (adds write overhead)
-- Requires pg_trgm extension to be enabled first

-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_saves_title_trgm ON saves USING gin(title gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_saves_description_trgm ON saves USING gin(description gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_saves_url_trgm ON saves USING gin(url gin_trgm_ops);

