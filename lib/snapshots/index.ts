/**
 * Snapshot processing utilities
 *
 * This module provides SSRF-safe fetching, readability extraction,
 * and HTML sanitization for creating Pocket-style article snapshots.
 */

import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { SNAPSHOT_STORAGE_PATH_PREFIX } from "@/lib/constants/snapshots";
import type { SnapshotBlockedReason, SnapshotContent } from "@/lib/types";
import { extractMetadata, extractReadableContent } from "./extract";
import { checkNoArchive, safeFetch } from "./fetch";
import { sanitizeContent } from "./sanitize";

export { extractMetadata, extractReadableContent } from "./extract";
export { checkNoArchive, safeFetch } from "./fetch";
export { escapeHtml, sanitizeContent, stripHtml } from "./sanitize";

export interface ProcessSnapshotResult {
  ok: true;
  content: SnapshotContent;
  metadata: {
    canonicalUrl: string | null;
    title: string | null;
    byline: string | null;
    excerpt: string;
    siteName: string | null;
    imageUrl: string | null;
    wordCount: number;
    language: string | null;
    contentSha256: string;
  };
}

export interface ProcessSnapshotError {
  ok: false;
  reason: SnapshotBlockedReason;
  message: string;
}

export type ProcessResult = ProcessSnapshotResult | ProcessSnapshotError;

/**
 * Process a URL into a readable snapshot
 * This is the main entry point for snapshot creation
 */
export async function processSnapshot(url: string): Promise<ProcessResult> {
  // 1. Fetch the page with SSRF protection
  const fetchResult = await safeFetch(url);
  if (!fetchResult.ok) {
    return fetchResult;
  }

  // 2. Check for noarchive directive
  if (checkNoArchive(fetchResult.headers, fetchResult.html)) {
    return { ok: false, reason: "noarchive", message: "Page has noarchive directive" };
  }

  // 3. Extract readable content
  const extractResult = extractReadableContent(fetchResult.html, fetchResult.finalUrl);
  if (!extractResult.ok) {
    return { ok: false, reason: "parse_failed", message: extractResult.message };
  }

  // 4. Sanitize the HTML content
  const sanitizedContent = sanitizeContent(extractResult.content.content);

  // 5. Extract additional metadata for backfilling
  const metadata = extractMetadata(fetchResult.html, fetchResult.finalUrl);

  // 6. Calculate content hash for deduplication
  const contentSha256 = createHash("sha256").update(sanitizedContent).digest("hex");

  // 7. Calculate word count
  const wordCount = extractResult.content.textContent
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  // Build final content object
  const content: SnapshotContent = {
    ...extractResult.content,
    content: sanitizedContent,
  };

  return {
    ok: true,
    content,
    metadata: {
      canonicalUrl: metadata.canonicalUrl || fetchResult.finalUrl,
      title: extractResult.content.title || metadata.title,
      byline: extractResult.content.byline,
      excerpt: extractResult.content.excerpt,
      siteName: extractResult.content.siteName || metadata.siteName,
      imageUrl: metadata.imageUrl,
      wordCount,
      language: extractResult.content.language,
      contentSha256,
    },
  };
}

/**
 * Generate the storage path for a snapshot
 */
export function getSnapshotStoragePath(spaceId: string, saveId: string): string {
  return `${SNAPSHOT_STORAGE_PATH_PREFIX}/${spaceId}/${saveId}/latest.json.gz`;
}

/**
 * Serialize snapshot content for storage (gzipped JSON)
 */
export function serializeSnapshot(content: SnapshotContent): Buffer {
  const json = JSON.stringify(content);
  return gzipSync(json);
}

/**
 * Deserialize snapshot content from storage
 */
export function deserializeSnapshot(data: Buffer): SnapshotContent {
  const json = gunzipSync(data).toString("utf-8");
  return JSON.parse(json) as SnapshotContent;
}
