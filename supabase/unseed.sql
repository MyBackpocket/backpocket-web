-- Cleanup script to remove seed data from Backpocket
-- Deletes in reverse order to respect foreign key constraints

-- 1. Remove junction table entries first
DELETE FROM save_collections WHERE save_id IN (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a06'
);

DELETE FROM save_tags WHERE save_id IN (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a06'
);

-- 2. Remove saves
DELETE FROM saves WHERE id IN (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a06'
);

-- 3. Remove collections
DELETE FROM collections WHERE id IN (
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02'
);

-- 4. Remove tags
DELETE FROM tags WHERE id IN (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a05'
);

-- 5. Remove the space
DELETE FROM spaces WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

