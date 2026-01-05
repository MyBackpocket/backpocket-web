-- Backpocket Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Spaces table
CREATE TABLE IF NOT EXISTS spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('personal', 'org')) DEFAULT 'personal',
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')) DEFAULT 'public',
    public_layout TEXT NOT NULL CHECK (public_layout IN ('list', 'grid')) DEFAULT 'grid',
    default_save_visibility TEXT NOT NULL CHECK (default_save_visibility IN ('private', 'public')) DEFAULT 'private',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Memberships table (links users to spaces)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Clerk user ID
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'writer', 'viewer')) DEFAULT 'owner',
    status TEXT NOT NULL CHECK (status IN ('active', 'invited', 'removed')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(space_id, user_id)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(space_id, name)
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')) DEFAULT 'private',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saves table
CREATE TABLE IF NOT EXISTS saves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    site_name TEXT,
    image_url TEXT,
    content_type TEXT DEFAULT 'article',
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')) DEFAULT 'private',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT NOT NULL, -- Clerk user ID
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Save snapshots table (Pocket-style readability snapshots)
CREATE TABLE IF NOT EXISTS save_snapshots (
    save_id UUID PRIMARY KEY REFERENCES saves(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'blocked', 'failed')) DEFAULT 'pending',
    blocked_reason TEXT CHECK (blocked_reason IN (
        'noarchive', 'forbidden', 'not_html', 'too_large', 
        'invalid_url', 'timeout', 'parse_failed', 'ssrf_blocked', 'fetch_error'
    )),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ,
    storage_path TEXT, -- e.g. 'snapshots/<spaceId>/<saveId>/latest.json.gz'
    canonical_url TEXT,
    title TEXT,
    byline TEXT,
    excerpt TEXT,
    word_count INTEGER,
    language TEXT,
    content_sha256 TEXT,
    error_message TEXT, -- Last error details for debugging
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Save-Tag junction table
CREATE TABLE IF NOT EXISTS save_tags (
    save_id UUID NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (save_id, tag_id)
);

-- Save-Collection junction table
CREATE TABLE IF NOT EXISTS save_collections (
    save_id UUID NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    PRIMARY KEY (save_id, collection_id)
);

-- Domain mappings for custom domains
CREATE TABLE IF NOT EXISTS domain_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT UNIQUE NOT NULL,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending_verification', 'verified', 'active', 'error', 'disabled')) DEFAULT 'pending_verification',
    verification_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Membership lookups (for auth/space resolution)
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_space_id ON memberships(space_id);
-- Composite for the most common auth lookup: user's active memberships
CREATE INDEX IF NOT EXISTS idx_memberships_user_status ON memberships(user_id, status) WHERE status = 'active';

-- Space lookups
CREATE INDEX IF NOT EXISTS idx_spaces_slug ON spaces(slug);

-- =============================================================================
-- SAVES INDEXES (critical for list/filter performance)
-- =============================================================================

-- Basic saves lookups
CREATE INDEX IF NOT EXISTS idx_saves_space_id ON saves(space_id);
CREATE INDEX IF NOT EXISTS idx_saves_visibility ON saves(visibility);

-- Main listing query: space + sorted by saved_at (covers most list views)
CREATE INDEX IF NOT EXISTS idx_saves_space_saved_at ON saves(space_id, saved_at DESC);

-- Filtered listing queries (common filters with sort)
CREATE INDEX IF NOT EXISTS idx_saves_space_visibility_saved_at ON saves(space_id, visibility, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saves_space_favorite_saved_at ON saves(space_id, is_favorite, saved_at DESC) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_saves_space_archived_saved_at ON saves(space_id, is_archived, saved_at DESC);

-- Legacy indexes (kept for compatibility, may be redundant)
CREATE INDEX IF NOT EXISTS idx_saves_saved_at ON saves(saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saves_space_visibility ON saves(space_id, visibility);

-- =============================================================================
-- JUNCTION TABLE INDEXES (critical for tag/collection filtering)
-- =============================================================================

-- save_tags: Primary key is (save_id, tag_id), but we also need index on tag_id
-- for "find all saves with this tag" queries
CREATE INDEX IF NOT EXISTS idx_save_tags_tag_id ON save_tags(tag_id);
-- Covering index for the join pattern: tag_id lookup returning save_id
CREATE INDEX IF NOT EXISTS idx_save_tags_tag_save ON save_tags(tag_id, save_id);

-- save_collections: Primary key is (save_id, collection_id), but we also need
-- index on collection_id for "find all saves in this collection" queries
CREATE INDEX IF NOT EXISTS idx_save_collections_collection_id ON save_collections(collection_id);
-- Covering index for the join pattern
CREATE INDEX IF NOT EXISTS idx_save_collections_collection_save ON save_collections(collection_id, save_id);

-- =============================================================================
-- OTHER INDEXES
-- =============================================================================

-- Tags and collections by space
CREATE INDEX IF NOT EXISTS idx_tags_space_id ON tags(space_id);
CREATE INDEX IF NOT EXISTS idx_collections_space_id ON collections(space_id);

-- Domain mappings
CREATE INDEX IF NOT EXISTS idx_domain_mappings_domain ON domain_mappings(domain);
CREATE INDEX IF NOT EXISTS idx_domain_mappings_space_id ON domain_mappings(space_id);

-- Snapshots
CREATE INDEX IF NOT EXISTS idx_save_snapshots_space_id ON save_snapshots(space_id);
CREATE INDEX IF NOT EXISTS idx_save_snapshots_status ON save_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_save_snapshots_next_attempt ON save_snapshots(next_attempt_at) WHERE status IN ('pending', 'failed');

-- =============================================================================
-- SEARCH OPTIMIZATION (optional - enable pg_trgm for ILIKE performance)
-- =============================================================================
-- Uncomment the following to enable trigram indexes for faster ILIKE searches.
-- This requires the pg_trgm extension and adds some write overhead.
-- 
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_saves_title_trgm ON saves USING gin(title gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_saves_description_trgm ON saves USING gin(description gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_saves_url_trgm ON saves USING gin(url gin_trgm_ops);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_spaces_updated_at ON spaces;
CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saves_updated_at ON saves;
CREATE TRIGGER update_saves_updated_at BEFORE UPDATE ON saves FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_domain_mappings_updated_at ON domain_mappings;
CREATE TRIGGER update_domain_mappings_updated_at BEFORE UPDATE ON domain_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_save_snapshots_updated_at ON save_snapshots;
CREATE TRIGGER update_save_snapshots_updated_at BEFORE UPDATE ON save_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access for public spaces
CREATE POLICY "Public spaces are viewable by everyone" ON spaces
    FOR SELECT USING (visibility = 'public');

-- Public saves are viewable by everyone
CREATE POLICY "Public saves are viewable by everyone" ON saves
    FOR SELECT USING (visibility = 'public');

-- Public snapshots are viewable when the associated save is public
CREATE POLICY "Public snapshots are viewable when save is public" ON save_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM saves 
            WHERE saves.id = save_snapshots.save_id 
            AND saves.visibility = 'public'
        )
    );

-- Service role has full access (for server-side operations)
-- Note: The service role key bypasses RLS by default

