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
import { getDomainExtractor } from "./domains";
import { extractMetadata, extractReadableContent } from "./extract";
import { checkNoArchive, safeFetch } from "./fetch";
import { sanitizeContent } from "./sanitize";

export { getDomainExtractor, hasDomainExtractor } from "./domains";
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
  // 1. Check for domain-specific extractor (Twitter, Instagram, etc.)
  const domainExtractor = getDomainExtractor(url);
  if (domainExtractor) {
    const domainResult = await domainExtractor(url);
    if (domainResult) {
      // Sanitize the content
      const sanitizedContent = sanitizeContent(domainResult.content);
      const contentSha256 = createHash("sha256").update(sanitizedContent).digest("hex");
      const wordCount = domainResult.textContent
        .split(/\s+/)
        .filter((word) => word.length > 0).length;

      const content: SnapshotContent = {
        ...domainResult,
        content: sanitizedContent,
      };

      return {
        ok: true,
        content,
        metadata: {
          canonicalUrl: url,
          title: domainResult.title,
          byline: domainResult.byline,
          excerpt: domainResult.excerpt,
          siteName: domainResult.siteName,
          imageUrl: null,
          wordCount,
          language: domainResult.language,
          contentSha256,
        },
      };
    }
    // Domain extractor failed, fall through to standard flow
  }

  // 2. Fetch the page with SSRF protection
  const fetchResult = await safeFetch(url);
  if (!fetchResult.ok) {
    return fetchResult;
  }

  // 3. Check for noarchive directive
  if (checkNoArchive(fetchResult.headers, fetchResult.html)) {
    return { ok: false, reason: "noarchive", message: "Page has noarchive directive" };
  }

  // 4. Extract readable content
  const extractResult = extractReadableContent(fetchResult.html, fetchResult.finalUrl);
  if (!extractResult.ok) {
    // 5. If Readability fails, try metadata fallback
    const metadata = extractMetadata(fetchResult.html, fetchResult.finalUrl);
    if (metadata.title || metadata.description) {
      const fallbackContent = buildMetadataFallbackContent(metadata, fetchResult.finalUrl);
      const sanitizedContent = sanitizeContent(fallbackContent.content);
      const contentSha256 = createHash("sha256").update(sanitizedContent).digest("hex");

      return {
        ok: true,
        content: { ...fallbackContent, content: sanitizedContent },
        metadata: {
          canonicalUrl: metadata.canonicalUrl || fetchResult.finalUrl,
          title: metadata.title,
          byline: null,
          excerpt: metadata.description || "",
          siteName: metadata.siteName,
          imageUrl: metadata.imageUrl,
          wordCount: fallbackContent.textContent.split(/\s+/).filter((w) => w.length > 0).length,
          language: null,
          contentSha256,
        },
      };
    }
    return { ok: false, reason: "parse_failed", message: extractResult.message };
  }

  // 6. Sanitize the HTML content
  const sanitizedContent = sanitizeContent(extractResult.content.content);

  // 7. Extract additional metadata for backfilling
  const metadata = extractMetadata(fetchResult.html, fetchResult.finalUrl);

  // 8. Calculate content hash for deduplication
  const contentSha256 = createHash("sha256").update(sanitizedContent).digest("hex");

  // 9. Calculate word count
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
 * Build a minimal SnapshotContent from metadata when Readability fails
 */
function buildMetadataFallbackContent(
  metadata: {
    title: string | null;
    description: string | null;
    siteName: string | null;
    imageUrl: string | null;
    canonicalUrl: string | null;
  },
  url: string
): SnapshotContent {
  const title = metadata.title || "Untitled";
  const textContent = metadata.description || "";
  const excerpt = textContent.slice(0, 300);

  const content = `
    <article>
      <p>${escapeHtmlSimple(textContent)}</p>
      <footer>
        <a href="${url}" rel="noopener noreferrer">View original</a>
      </footer>
    </article>
  `.trim();

  return {
    title,
    byline: null,
    content,
    textContent,
    excerpt,
    siteName: metadata.siteName,
    length: textContent.length,
    language: null,
  };
}

/**
 * Simple HTML escaping for fallback content
 */
function escapeHtmlSimple(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
