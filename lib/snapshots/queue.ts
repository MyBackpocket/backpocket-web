/**
 * Snapshot job queue using Upstash QStash
 *
 * QStash provides reliable message delivery with automatic retries,
 * making it ideal for serverless snapshot processing.
 */

import { Client } from "@upstash/qstash";
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
 */
export async function enqueueSnapshotJob(
  saveId: string,
  spaceId: string,
  url: string
): Promise<EnqueueResult> {
  if (!SNAPSHOTS_ENABLED) {
    return { ok: false, error: "Snapshots are disabled" };
  }

  const qstash = getQStashClient();
  if (!qstash) {
    return { ok: false, error: "QStash not configured" };
  }

  try {
    const workerUrl = getWorkerUrl();

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

    return { ok: true, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[snapshots] Failed to enqueue job:", message);
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
