-- Comprehensive Seed Data for Backpocket
-- Best for first-time setup

-- 1. Create the primary Space
INSERT INTO spaces (id, type, slug, name, bio, visibility, public_layout)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'personal',
    'mario',
    'Mario''s Collection',
    'A curated collection of high-signal technical articles and design resources.',
    'public',
    'grid'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create Tags
INSERT INTO tags (id, space_id, name) VALUES
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'design'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'development'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'productivity'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ai'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'reading')
ON CONFLICT (space_id, name) DO NOTHING;

-- 3. Create Collections
INSERT INTO collections (id, space_id, name, visibility) VALUES
    ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Must Reads', 'public'),
    ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dev Resources', 'public')
ON CONFLICT DO NOTHING;

-- 4. Insert Real, High-Quality Saves
INSERT INTO saves (id, space_id, url, title, description, site_name, content_type, visibility, is_favorite, created_by, saved_at) VALUES
    (
        'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'https://nextjs.org/blog/next-16-1',
        'Next.js 16.1: Turbopack File System Caching',
        'The stabilization of Turbopack caching and new improvements to React Server Components.',
        'Next.js Blog',
        'article',
        'public',
        true,
        'seed-user',
        NOW() - INTERVAL '11 days'
    ),
    (
        'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'https://www.joshwcomeau.com/css/subgrid/',
        'Brand New Layouts with CSS Subgrid',
        'A comprehensive guide to CSS Subgrid and how it revolutionizes nested grid layouts.',
        'Josh W Comeau',
        'article',
        'public',
        true,
        'seed-user',
        NOW() - INTERVAL '20 days'
    ),
    (
        'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'https://www.joshwcomeau.com/blog/the-post-developer-era/',
        'The Post-Developer Era',
        'Josh explores the shifting landscape of software engineering in the age of LLMs.',
        'Josh W Comeau',
        'article',
        'public',
        true,
        'seed-user',
        NOW() - INTERVAL '35 days'
    ),
    (
        'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'https://antirez.com/news/157',
        'Reflections on AI at the end of 2025',
        'The creator of Redis shares a technical perspective on the current state of AI and coding.',
        'antirez.com',
        'article',
        'public',
        false,
        'seed-user',
        NOW() - INTERVAL '10 days'
    ),
    (
        'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'https://www.youtube.com/watch?v=SjZSy8s2VEE',
        'Building a Second Brain: The Illustrated Guide',
        'Tiago Forte explains the PARA method for digital organization.',
        'YouTube',
        'video',
        'public',
        false,
        'seed-user',
        NOW() - INTERVAL '40 days'
    ),
    (
        'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a06',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'https://maggieappleton.com/garden-history',
        'A Brief History of the Digital Garden',
        'Exploring the ethos of digital gardening vs. traditional blogging.',
        'Maggie Appleton',
        'article',
        'public',
        false,
        'seed-user',
        NOW() - INTERVAL '60 days'
    )
ON CONFLICT (id) DO NOTHING;

-- 5. Link Everything Up
INSERT INTO save_tags (save_id, tag_id) VALUES
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02'), -- Next.js -> dev
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'), -- Subgrid -> design
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02'), -- Subgrid -> dev
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04'), -- Post-Dev -> ai
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04'), -- Antirez -> ai
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03'), -- Second Brain -> productivity
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05')  -- Garden -> reading
ON CONFLICT DO NOTHING;

INSERT INTO save_collections (save_id, collection_id) VALUES
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02'), -- Next.js -> Dev Res
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'), -- Subgrid -> Must Read
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'), -- Post-Dev -> Must Read
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01')  -- Antirez -> Must Read
ON CONFLICT DO NOTHING;
