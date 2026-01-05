-- Delete duplicate saves, keeping the oldest one per (space_id, normalized_url)
--
-- IMPORTANT: Run the backfill script FIRST to populate normalized_url:
--   bun run scripts/backfill-normalized-urls.ts
--
-- Then review this script and run it in Supabase SQL Editor.

-- First, let's see what duplicates exist (DRY RUN - no changes)
SELECT 
  space_id,
  normalized_url,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY saved_at ASC) as save_ids,
  array_agg(title ORDER BY saved_at ASC) as titles,
  MIN(saved_at) as first_saved,
  MAX(saved_at) as last_saved
FROM saves
WHERE normalized_url IS NOT NULL
GROUP BY space_id, normalized_url
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Uncomment the DELETE below to actually remove duplicates
-- This keeps the OLDEST save (earliest saved_at) and deletes the rest

/*
DELETE FROM saves
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY space_id, normalized_url 
        ORDER BY saved_at ASC
      ) as rn
    FROM saves
    WHERE normalized_url IS NOT NULL
  ) ranked
  WHERE rn > 1  -- Delete all but the first (oldest)
);
*/

-- Alternative: Keep the NEWEST save instead (uncomment below)
/*
DELETE FROM saves
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY space_id, normalized_url 
        ORDER BY saved_at DESC
      ) as rn
    FROM saves
    WHERE normalized_url IS NOT NULL
  ) ranked
  WHERE rn > 1  -- Delete all but the first (newest)
);
*/

