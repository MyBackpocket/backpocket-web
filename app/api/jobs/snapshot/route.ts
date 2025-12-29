/**
 * Snapshot Worker Endpoint
 *
 * Receives jobs from QStash (or direct calls with worker secret)
 * and processes URL snapshots.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  SNAPSHOT_MAX_ATTEMPTS,
  SNAPSHOT_STORAGE_BUCKET,
  SNAPSHOTS_ENABLED,
} from "@/lib/constants/snapshots";
import { getSnapshotStoragePath, processSnapshot, serializeSnapshot } from "@/lib/snapshots";
import {
  checkDomainPoliteness,
  enqueueSnapshotRetry,
  markDomainFetched,
  verifyQStashSignature,
  verifyWorkerSecret,
} from "@/lib/snapshots/queue";
import { supabaseAdmin } from "@/lib/supabase";

// Job payload schema
const jobPayloadSchema = z.object({
  saveId: z.string().uuid(),
  spaceId: z.string().uuid(),
  url: z.string().url(),
  attempt: z.number().int().min(1).max(SNAPSHOT_MAX_ATTEMPTS).default(1),
});

type JobPayload = z.infer<typeof jobPayloadSchema>;

export const runtime = "nodejs";
export const maxDuration = 30; // 30 second timeout

export async function POST(request: Request) {
  // Check if snapshots are enabled
  if (!SNAPSHOTS_ENABLED) {
    return NextResponse.json({ error: "Snapshots are disabled" }, { status: 503 });
  }

  // Get raw body for signature verification
  const rawBody = await request.text();

  // Verify authentication (QStash signature or worker secret)
  const qstashSignature = request.headers.get("upstash-signature");
  const workerSecret = request.headers.get("x-worker-secret");

  const isQStashValid = await verifyQStashSignature(qstashSignature, rawBody);
  const isSecretValid = verifyWorkerSecret(workerSecret);

  if (!isQStashValid && !isSecretValid) {
    console.error("[snapshot-worker] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate payload
  let payload: JobPayload;
  try {
    const json = JSON.parse(rawBody);
    payload = jobPayloadSchema.parse(json);
  } catch (error) {
    console.error("[snapshot-worker] Invalid payload:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { saveId, spaceId, url, attempt } = payload;
  console.log(`[snapshot-worker] Processing save=${saveId} url=${url} attempt=${attempt}`);

  try {
    // Update status to processing
    await supabaseAdmin
      .from("save_snapshots")
      .update({
        status: "processing",
        attempts: attempt,
      })
      .eq("save_id", saveId);

    // Check domain politeness
    const domain = new URL(url).hostname;
    const politeness = await checkDomainPoliteness(domain);

    if (!politeness.allowed) {
      // Re-queue with delay
      console.log(
        `[snapshot-worker] Domain politeness: waiting ${politeness.waitMs}ms for ${domain}`
      );

      // Update status back to pending
      await supabaseAdmin
        .from("save_snapshots")
        .update({
          status: "pending",
          next_attempt_at: new Date(Date.now() + politeness.waitMs).toISOString(),
        })
        .eq("save_id", saveId);

      // Re-enqueue with delay (will be handled by QStash retry)
      return NextResponse.json({
        status: "delayed",
        waitMs: politeness.waitMs,
      });
    }

    // Process the snapshot
    const result = await processSnapshot(url);

    // Mark domain as fetched
    await markDomainFetched(domain);

    if (!result.ok) {
      // Check if this is a retriable error
      const retriableReasons = ["timeout", "fetch_error"];
      const isRetriable = retriableReasons.includes(result.reason);

      if (isRetriable && attempt < SNAPSHOT_MAX_ATTEMPTS) {
        // Schedule retry
        const retryResult = await enqueueSnapshotRetry(saveId, spaceId, url, attempt);

        await supabaseAdmin
          .from("save_snapshots")
          .update({
            status: "pending",
            error_message: result.message,
            next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
          })
          .eq("save_id", saveId);

        return NextResponse.json({
          status: "retrying",
          reason: result.reason,
          message: result.message,
          retry: retryResult.ok,
        });
      }

      // Permanent failure or max attempts reached
      const finalStatus = result.reason === "noarchive" ? "blocked" : "failed";

      await supabaseAdmin
        .from("save_snapshots")
        .update({
          status: finalStatus,
          blocked_reason: result.reason,
          error_message: result.message,
        })
        .eq("save_id", saveId);

      console.log(`[snapshot-worker] Failed: ${result.reason} - ${result.message}`);
      return NextResponse.json({
        status: finalStatus,
        reason: result.reason,
        message: result.message,
      });
    }

    // Success! Store the snapshot content
    const storagePath = getSnapshotStoragePath(spaceId, saveId);
    const serialized = serializeSnapshot(result.content);

    // Store in Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(SNAPSHOT_STORAGE_BUCKET)
      .upload(storagePath, serialized, {
        contentType: "application/gzip",
        upsert: true,
      });

    if (uploadError) {
      console.error("[snapshot-worker] Storage upload failed:", uploadError);

      // Retry if storage failed
      if (attempt < SNAPSHOT_MAX_ATTEMPTS) {
        const retryResult = await enqueueSnapshotRetry(saveId, spaceId, url, attempt);

        await supabaseAdmin
          .from("save_snapshots")
          .update({
            status: "pending",
            error_message: `Storage upload failed: ${uploadError.message}`,
          })
          .eq("save_id", saveId);

        return NextResponse.json({
          status: "retrying",
          reason: "storage_error",
          message: uploadError.message,
          retry: retryResult.ok,
        });
      }

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

    // Backfill save metadata if missing
    const { data: save } = await supabaseAdmin
      .from("saves")
      .select("title, site_name, image_url, description")
      .eq("id", saveId)
      .single();

    if (save) {
      const updates: Record<string, unknown> = {};

      if (!save.title && result.metadata.title) {
        updates.title = result.metadata.title;
      }
      if (!save.site_name && result.metadata.siteName) {
        updates.site_name = result.metadata.siteName;
      }
      if (!save.image_url && result.metadata.imageUrl) {
        updates.image_url = result.metadata.imageUrl;
      }
      if (!save.description && result.metadata.excerpt) {
        updates.description = result.metadata.excerpt;
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from("saves").update(updates).eq("id", saveId);
      }
    }

    console.log(`[snapshot-worker] Success: save=${saveId} words=${result.metadata.wordCount}`);

    return NextResponse.json({
      status: "ready",
      wordCount: result.metadata.wordCount,
      title: result.metadata.title,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[snapshot-worker] Unexpected error: ${message}`);

    // Try to update status
    try {
      await supabaseAdmin
        .from("save_snapshots")
        .update({
          status: "failed",
          blocked_reason: "fetch_error",
          error_message: message,
        })
        .eq("save_id", saveId);
    } catch {
      // Ignore update error
    }

    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
