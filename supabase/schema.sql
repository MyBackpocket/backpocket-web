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
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public', 'unlisted')) DEFAULT 'private',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT NOT NULL, -- Clerk user ID
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_space_id ON memberships(space_id);
CREATE INDEX IF NOT EXISTS idx_saves_space_id ON saves(space_id);
CREATE INDEX IF NOT EXISTS idx_saves_visibility ON saves(visibility);
CREATE INDEX IF NOT EXISTS idx_saves_saved_at ON saves(saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saves_space_visibility ON saves(space_id, visibility);
CREATE INDEX IF NOT EXISTS idx_tags_space_id ON tags(space_id);
CREATE INDEX IF NOT EXISTS idx_collections_space_id ON collections(space_id);
CREATE INDEX IF NOT EXISTS idx_spaces_slug ON spaces(slug);
CREATE INDEX IF NOT EXISTS idx_domain_mappings_domain ON domain_mappings(domain);

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

-- Row Level Security (RLS) Policies
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_mappings ENABLE ROW LEVEL SECURITY;

-- Public read access for public spaces
CREATE POLICY "Public spaces are viewable by everyone" ON spaces
    FOR SELECT USING (visibility = 'public');

-- Public saves are viewable by everyone
CREATE POLICY "Public saves are viewable by everyone" ON saves
    FOR SELECT USING (visibility IN ('public', 'unlisted'));

-- Service role has full access (for server-side operations)
-- Note: The service role key bypasses RLS by default

