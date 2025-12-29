/**
 * Development-only endpoint to manually trigger snapshot processing
 * This bypasses QStash for local development convenience.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { IS_DEVELOPMENT } from "@/lib/config/public";
import { SNAPSHOT_STORAGE_BUCKET } from "@/lib/constants/snapshots";
import { getSnapshotStoragePath, processSnapshot, serializeSnapshot } from "@/lib/snapshots";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

const inputSchema = z.object({
  saveId: z.string().uuid(),
});

export async function POST(request: Request) {
  // Only allow in development mode
  if (!IS_DEVELOPMENT) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  let input: z.infer<typeof inputSchema>;
  try {
    const json = await request.json();
    input = inputSchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { saveId } = input;

  // Get the save to get URL and space_id
  const { data: save, error: saveError } = await supabaseAdmin
    .from("saves")
    .select("id, url, space_id")
    .eq("id", saveId)
    .single();

  if (saveError || !save) {
    return NextResponse.json({ error: "Save not found" }, { status: 404 });
  }

  const spaceId = save.space_id;
  const url = save.url;

  console.log(`[dev-snapshot] Processing save=${saveId} url=${url}`);

  // Ensure snapshot record exists
  const { data: existingSnapshot } = await supabaseAdmin
    .from("save_snapshots")
    .select("save_id")
    .eq("save_id", saveId)
    .single();

  if (!existingSnapshot) {
    await supabaseAdmin.from("save_snapshots").insert({
      save_id: saveId,
      space_id: spaceId,
      status: "pending",
    });
  }

  // Update status to processing
  await supabaseAdmin
    .from("save_snapshots")
    .update({ status: "processing", attempts: 1 })
    .eq("save_id", saveId);

  try {
    // Process the snapshot
    const result = await processSnapshot(url);

    if (!result.ok) {
      const finalStatus = result.reason === "noarchive" ? "blocked" : "failed";

      await supabaseAdmin
        .from("save_snapshots")
        .update({
          status: finalStatus,
          blocked_reason: result.reason,
          error_message: result.message,
        })
        .eq("save_id", saveId);

      return NextResponse.json({
        status: finalStatus,
        reason: result.reason,
        message: result.message,
      });
    }

    // Store the snapshot content
    const storagePath = getSnapshotStoragePath(spaceId, saveId);
    const serialized = serializeSnapshot(result.content);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(SNAPSHOT_STORAGE_BUCKET)
      .upload(storagePath, serialized, {
        contentType: "application/gzip",
        upsert: true,
      });

    if (uploadError) {
      console.error("[dev-snapshot] Storage upload failed:", uploadError);

      await supabaseAdmin
        .from("save_snapshots")
        .update({
          status: "failed",
          blocked_reason: "fetch_error",
          error_message: `Storage upload failed: ${uploadError.message}`,
        })
        .eq("save_id", saveId);

      return NextResponse.json({
        status: "failed",
        reason: "storage_error",
        message: uploadError.message,
      });
    }

    // Update snapshot record with success
    await supabaseAdmin
      .from("save_snapshots")
      .update({
        status: "ready",
        fetched_at: new Date().toISOString(),
        storage_path: storagePath,
        canonical_url: result.metadata.canonicalUrl,
        title: result.metadata.title,
        byline: result.metadata.byline,
        excerpt: result.metadata.excerpt,
        word_count: result.metadata.wordCount,
        language: result.metadata.language,
        content_sha256: result.metadata.contentSha256,
        error_message: null,
        blocked_reason: null,
      })
      .eq("save_id", saveId);

    // Backfill save metadata
    const updates: Record<string, unknown> = {};
    if (result.metadata.title) {
      updates.title = result.metadata.title;
    }
    if (result.metadata.siteName) {
      updates.site_name = result.metadata.siteName;
    }
    if (result.metadata.imageUrl) {
      updates.image_url = result.metadata.imageUrl;
    }
    if (result.metadata.excerpt) {
      updates.description = result.metadata.excerpt;
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from("saves").update(updates).eq("id", saveId);
    }

    console.log(`[dev-snapshot] Success: save=${saveId} words=${result.metadata.wordCount}`);

    return NextResponse.json({
      status: "ready",
      wordCount: result.metadata.wordCount,
      title: result.metadata.title,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[dev-snapshot] Unexpected error: ${message}`);

    await supabaseAdmin
      .from("save_snapshots")
      .update({
        status: "failed",
        blocked_reason: "fetch_error",
        error_message: message,
      })
      .eq("save_id", saveId);

    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
