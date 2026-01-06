-- Migration: Collection Default Tags
-- Adds ability for collections to have default tags that auto-apply to saves

-- Collection Default Tags Junction Table
CREATE TABLE IF NOT EXISTS collection_default_tags (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, tag_id)
);

-- Index for finding all collections that have a specific tag as default
CREATE INDEX IF NOT EXISTS idx_collection_default_tags_tag_id ON collection_default_tags(tag_id);

-- Enable RLS
ALTER TABLE collection_default_tags ENABLE ROW LEVEL SECURITY;

