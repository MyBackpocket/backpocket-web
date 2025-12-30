/**
 * Snapshot job queue using Upstash QStash
 *
 * QStash provides reliable message delivery with automatic retries,
 * making it ideal for serverless snapshot processing.
 *
 * In development, jobs are processed directly since QStash cannot
 * reach localhost.
 */

import { Client } from "@upstash/qstash";
import { IS_DEVELOPMENT } from "@/lib/config/public";
import {
  SNAPSHOT_DOMAIN_POLITENESS_MS,
  SNAPSHOT_MAX_ATTEMPTS,
  SNAPSHOT_RETRY_DELAYS_MS,
  SNAPSHOT_USER_RATE_LIMIT,
  SNAPSHOT_USER_RATE_WINDOW_SECONDS,
  SNAPSHOTS_ENABLED,
} from "@/lib/constants/snapshots";
import { redis } from "@/lib/redis";

// Lazy initialization of QStash client
let _qstash: Client | null = null;

function getQStashClient(): Client | null {
  if (_qstash) return _qstash;

  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    console.warn("[snapshots] QStash not configured - snapshot jobs will be skipped");
    return null;
  }

  _qstash = new Client({ token });
  return _qstash;
}

/**
 * Get the worker endpoint URL
 */
function getWorkerUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or VERCEL_URL must be set for snapshot worker");
  }
  const protocol = baseUrl.startsWith("localhost") ? "http" : "https";
  const cleanUrl = baseUrl.replace(/^https?:\/\//, "");
  return `${protocol}://${cleanUrl}/api/jobs/snapshot`;
}

export interface EnqueueResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Enqueue a snapshot job for processing
 *
 * In development mode, processes the snapshot directly since QStash
 * cannot reach localhost. In production, uses QStash for reliable
 * background processing.
 */
export async function enqueueSnapshotJob(
  saveId: string,
  spaceId: string,
  url: string
): Promise<EnqueueResult> {
  console.log(`[snapshots] ========== enqueueSnapshotJob called ==========`);
  console.log(`[snapshots] saveId=${saveId}, url=${url}`);
  console.log(`[snapshots] SNAPSHOTS_ENABLED=${SNAPSHOTS_ENABLED}, IS_DEVELOPMENT=${IS_DEVELOPMENT}`);
  
  if (!SNAPSHOTS_ENABLED) {
    console.log(`[snapshots] Returning early: snapshots disabled`);
    return { ok: false, error: "Snapshots are disabled" };
  }

  // In development, process directly since QStash can't reach localhost
  if (IS_DEVELOPMENT) {
    console.log(`[snapshots] Dev mode: processing snapshot directly for save=${saveId}`);
    // Process asynchronously but don't await - fire and forget
    processSnapshotInDev(saveId, spaceId, url);
    return { ok: true, messageId: `dev-${saveId}` };
  }

  // Debug logging for production
  console.log(`[snapshots] Production mode: using QStash`, {
    hasQstashToken: !!process.env.QSTASH_TOKEN,
    hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    hasVercelUrl: !!process.env.VERCEL_URL,
    vercelUrl: process.env.VERCEL_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
  });

  const qstash = getQStashClient();
  if (!qstash) {
    console.error("[snapshots] QStash client not available - QSTASH_TOKEN missing");
    return { ok: false, error: "QStash not configured" };
  }

  let workerUrl: string;
  try {
    workerUrl = getWorkerUrl();
    console.log(`[snapshots] Worker URL: ${workerUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[snapshots] Failed to get worker URL:", message);
    return { ok: false, error: message };
  }

  try {
    const result = await qstash.publishJSON({
      url: workerUrl,
      body: {
        saveId,
        spaceId,
        url,
        attempt: 1,
      },
      // Retry configuration
      retries: SNAPSHOT_MAX_ATTEMPTS - 1,
      // Add some initial delay to avoid thundering herd on bulk imports
      delay: Math.floor(Math.random() * 5), // 0-5 seconds random delay
    });

    console.log(`[snapshots] Successfully enqueued job: messageId=${result.messageId}`);
    return { ok: true, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[snapshots] Failed to publish to QStash:", message, error);
    return { ok: false, error: message };
  }
}

/**
 * Enqueue a retry for a failed snapshot job with exponential backoff
 */
export async function enqueueSnapshotRetry(
  saveId: string,
  spaceId: string,
  url: string,
  attempt: number
): Promise<EnqueueResult> {
  if (!SNAPSHOTS_ENABLED) {
    return { ok: false, error: "Snapshots are disabled" };
  }

  if (attempt >= SNAPSHOT_MAX_ATTEMPTS) {
    return { ok: false, error: "Max attempts exceeded" };
  }

  const qstash = getQStashClient();
  if (!qstash) {
    return { ok: false, error: "QStash not configured" };
  }

  try {
    const workerUrl = getWorkerUrl();
    const delayMs =
      SNAPSHOT_RETRY_DELAYS_MS[attempt - 1] ||
      SNAPSHOT_RETRY_DELAYS_MS[SNAPSHOT_RETRY_DELAYS_MS.length - 1];
    const delaySeconds = Math.floor(delayMs / 1000);

    const result = await qstash.publishJSON({
      url: workerUrl,
      body: {
        saveId,
        spaceId,
        url,
        attempt: attempt + 1,
      },
      delay: delaySeconds,
    });

    return { ok: true, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[snapshots] Failed to enqueue retry:", message);
    return { ok: false, error: message };
  }
}

// Redis key helpers for rate limiting
const userRateLimitKey = (userId: string) => `snapshots:user:${userId}:count`;
const domainLastFetchKey = (domain: string) => `snapshots:domain:${domain}:last`;

/**
 * Check if user has exceeded their snapshot rate limit
 */
export async function checkUserRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const key = userRateLimitKey(userId);
  const count = await redis.incr(key);

  // Set expiry on first increment
  if (count === 1) {
    await redis.expire(key, SNAPSHOT_USER_RATE_WINDOW_SECONDS);
  }

  return {
    allowed: count <= SNAPSHOT_USER_RATE_LIMIT,
    remaining: Math.max(0, SNAPSHOT_USER_RATE_LIMIT - count),
  };
}

/**
 * Get remaining snapshot quota for a user
 */
export async function getUserSnapshotQuota(userId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const key = userRateLimitKey(userId);
  const count = (await redis.get<number>(key)) || 0;

  return {
    used: count,
    remaining: Math.max(0, SNAPSHOT_USER_RATE_LIMIT - count),
    limit: SNAPSHOT_USER_RATE_LIMIT,
  };
}

/**
 * Check domain politeness - ensure we don't hammer the same domain
 */
export async function checkDomainPoliteness(domain: string): Promise<{
  allowed: boolean;
  waitMs: number;
}> {
  const key = domainLastFetchKey(domain);
  const lastFetch = await redis.get<number>(key);
  const now = Date.now();

  if (!lastFetch) {
    // First fetch to this domain
    await redis.set(key, now, { ex: 60 }); // Keep for 60 seconds
    return { allowed: true, waitMs: 0 };
  }

  const elapsed = now - lastFetch;
  if (elapsed >= SNAPSHOT_DOMAIN_POLITENESS_MS) {
    // Enough time has passed
    await redis.set(key, now, { ex: 60 });
    return { allowed: true, waitMs: 0 };
  }

  // Need to wait
  const waitMs = SNAPSHOT_DOMAIN_POLITENESS_MS - elapsed;
  return { allowed: false, waitMs };
}

/**
 * Mark a domain as fetched (update last fetch time)
 */
export async function markDomainFetched(domain: string): Promise<void> {
  const key = domainLastFetchKey(domain);
  await redis.set(key, Date.now(), { ex: 60 });
}

/**
 * Verify QStash webhook signature
 */
export async function verifyQStashSignature(
  signature: string | null,
  body: string
): Promise<boolean> {
  if (!signature) {
    // Check for worker secret as fallback (for local development)
    return false;
  }

  const qstash = getQStashClient();
  if (!qstash) {
    return false;
  }

  try {
    const { Receiver } = await import("@upstash/qstash");
    const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!signingKey) {
      console.warn("[snapshots] QSTASH_CURRENT_SIGNING_KEY not set");
      return false;
    }

    const receiver = new Receiver({
      currentSigningKey: signingKey,
      nextSigningKey: nextSigningKey || signingKey,
    });

    const isValid = await receiver.verify({
      signature,
      body,
    });

    return isValid;
  } catch (error) {
    console.error("[snapshots] Signature verification failed:", error);
    return false;
  }
}

/**
 * Verify worker secret (alternative to QStash for development)
 */
export function verifyWorkerSecret(secret: string | null): boolean {
  const expectedSecret = process.env.SNAPSHOT_WORKER_SECRET;
  if (!expectedSecret) {
    return false;
  }
  return secret === expectedSecret;
}

/**
 * Process a snapshot directly in development mode.
 * This bypasses QStash since it cannot reach localhost.
 */
async function processSnapshotInDev(saveId: string, spaceId: string, url: string): Promise<void> {
  // Delay import to avoid circular dependencies
  const { SNAPSHOT_STORAGE_BUCKET } = await import("@/lib/constants/snapshots");
  const { getSnapshotStoragePath, processSnapshot, serializeSnapshot } = await import(
    "@/lib/snapshots"
  );
  const { supabaseAdmin } = await import("@/lib/supabase");

  try {
    console.log(`[snapshots-dev] Processing save=${saveId} url=${url}`);

    // Update status to processing
    await supabaseAdmin
      .from("save_snapshots")
      .update({ status: "processing", attempts: 1 })
      .eq("save_id", saveId);

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
      console.log(`[snapshots-dev] Failed: ${result.reason} - ${result.message}`);
      return;
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
      console.error("[snapshots-dev] Storage upload failed:", uploadError);
      await supabaseAdmin
        .from("save_snapshots")
        .update({
          status: "failed",
          blocked_reason: "fetch_error",
          error_message: `Storage upload failed: ${uploadError.message}`,
        })
        .eq("save_id", saveId);
      return;
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
      if (!save.title && result.metadata.title) updates.title = result.metadata.title;
      if (!save.site_name && result.metadata.siteName) updates.site_name = result.metadata.siteName;
      if (!save.image_url && result.metadata.imageUrl) updates.image_url = result.metadata.imageUrl;
      if (!save.description && result.metadata.excerpt)
        updates.description = result.metadata.excerpt;

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from("saves").update(updates).eq("id", saveId);
      }
    }

    console.log(`[snapshots-dev] Success: save=${saveId} words=${result.metadata.wordCount}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[snapshots-dev] Unexpected error: ${message}`);

    try {
      const { supabaseAdmin } = await import("@/lib/supabase");
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
  }
}
