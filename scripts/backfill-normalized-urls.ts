/**
 * Backfill normalized_url for existing saves
 *
 * Run with: bun run scripts/backfill-normalized-urls.ts
 *
 * This script:
 * 1. Fetches all saves missing normalized_url
 * 2. Computes and updates their normalized_url
 * 3. Reports any duplicates found
 */

import { createClient } from "@supabase/supabase-js";
import { normalizeUrl } from "../lib/utils/url";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Save {
  id: string;
  space_id: string;
  url: string;
  title: string | null;
  saved_at: string;
}

interface Duplicate {
  spaceId: string;
  normalizedUrl: string;
  saves: Save[];
}

async function backfill() {
  console.log("🔍 Fetching saves without normalized_url...\n");

  // Fetch all saves that don't have a normalized_url
  const { data: saves, error } = await supabase
    .from("saves")
    .select("id, space_id, url, title, saved_at")
    .is("normalized_url", null)
    .order("saved_at", { ascending: true });

  if (error) {
    console.error("Error fetching saves:", error);
    process.exit(1);
  }

  if (!saves || saves.length === 0) {
    console.log("✅ All saves already have normalized_url set!");
    return;
  }

  console.log(`Found ${saves.length} saves to process\n`);

  // Track duplicates by space_id + normalized_url
  const seen = new Map<string, Save[]>();
  const updates: { id: string; normalized_url: string }[] = [];
  let processed = 0;
  let skipped = 0;

  for (const save of saves) {
    const normalized = normalizeUrl(save.url);

    if (!normalized) {
      console.log(`⚠️  Skipping invalid URL: ${save.url}`);
      skipped++;
      continue;
    }

    const key = `${save.space_id}:${normalized}`;

    // Track for duplicate detection
    const existing = seen.get(key) || [];
    existing.push(save);
    seen.set(key, existing);

    updates.push({ id: save.id, normalized_url: normalized });
    processed++;

    // Progress indicator
    if (processed % 100 === 0) {
      console.log(`  Processed ${processed}/${saves.length}...`);
    }
  }

  console.log(`\n📝 Updating ${updates.length} saves...\n`);

  // Batch update in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    for (const update of batch) {
      const { error: updateError } = await supabase
        .from("saves")
        .update({ normalized_url: update.normalized_url })
        .eq("id", update.id);

      if (updateError) {
        // Likely a unique constraint violation (duplicate)
        console.log(`⚠️  Failed to update save ${update.id}: ${updateError.message}`);
      }
    }

    console.log(`  Updated ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
  }

  // Find and report duplicates
  const duplicates: Duplicate[] = [];
  for (const [key, savesForKey] of seen.entries()) {
    if (savesForKey.length > 1) {
      const [spaceId, _normalizedUrl] = key.split(":", 2);
      duplicates.push({
        spaceId,
        normalizedUrl: key.substring(spaceId.length + 1),
        saves: savesForKey,
      });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Processed: ${processed}`);
  console.log(`⚠️  Skipped (invalid URL): ${skipped}`);
  console.log(`🔄 Duplicates found: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("DUPLICATES DETECTED");
    console.log("=".repeat(60));
    console.log("\nThe following URLs have multiple saves (keep the oldest, delete the rest):\n");

    for (const dup of duplicates) {
      console.log(`URL: ${dup.normalizedUrl}`);
      console.log(`Space: ${dup.spaceId}`);
      console.log("Saves:");
      for (const save of dup.saves) {
        console.log(`  - ${save.id} | ${save.saved_at} | "${save.title || "(no title)"}"`);
      }
      console.log();
    }

    console.log("=".repeat(60));
    console.log("To delete duplicates, run the SQL in scripts/delete-duplicate-saves.sql");
    console.log("Or manually delete the newer saves from the list above.");
  }
}

backfill().catch(console.error);
