/**
 * SSRF-safe URL fetching utilities
 */

import {
  SNAPSHOT_ALLOWED_CONTENT_TYPES,
  SNAPSHOT_FETCH_TIMEOUT_MS,
  SNAPSHOT_MAX_CONTENT_SIZE,
  SNAPSHOT_MAX_REDIRECTS,
  SNAPSHOT_USER_AGENT,
} from "@/lib/constants/snapshots";
import type { SnapshotBlockedReason } from "@/lib/types";

// Private/reserved IP ranges to block (SSRF protection)
const BLOCKED_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
  /^192\.0\.0\./, // IETF Protocol Assignments
  /^192\.0\.2\./, // TEST-NET-1
  /^198\.51\.100\./, // TEST-NET-2
  /^203\.0\.113\./, // TEST-NET-3
  /^224\./, // Multicast
  /^240\./, // Reserved
  /^255\./, // Broadcast
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 unique local
  /^fe80:/, // IPv6 link-local
  /^ff00:/, // IPv6 multicast
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal", // GCP metadata
  "169.254.169.254", // AWS/GCP/Azure metadata
];

export interface FetchResult {
  ok: true;
  html: string;
  finalUrl: string;
  contentType: string;
  headers: Record<string, string>;
}

export interface FetchError {
  ok: false;
  reason: SnapshotBlockedReason;
  message: string;
}

export type SafeFetchResult = FetchResult | FetchError;

/**
 * Check if URL is safe to fetch (not pointing to internal/private resources)
 */
function isUrlSafe(url: string): {
  safe: boolean;
  reason?: SnapshotBlockedReason;
  message?: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: "invalid_url", message: "Invalid URL format" };
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      safe: false,
      reason: "invalid_url",
      message: `Protocol ${parsed.protocol} not allowed`,
    };
  }

  // Check hostname against blocklist
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { safe: false, reason: "ssrf_blocked", message: `Hostname ${hostname} is blocked` };
  }

  // Check if hostname looks like an IP address
  const ipv4Match = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  const ipv6Match = hostname.match(/^\[.*\]$/) || hostname.includes(":");

  if (ipv4Match || ipv6Match) {
    const ip = hostname.replace(/^\[|\]$/g, "");
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(ip)) {
        return {
          safe: false,
          reason: "ssrf_blocked",
          message: `IP address ${ip} is in a blocked range`,
        };
      }
    }
  }

  return { safe: true };
}

/**
 * Safely fetch a URL with SSRF protections, size limits, and timeout
 */
export async function safeFetch(url: string): Promise<SafeFetchResult> {
  // Initial URL validation
  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { ok: false, reason: urlCheck.reason!, message: urlCheck.message! };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SNAPSHOT_FETCH_TIMEOUT_MS);

  let redirectCount = 0;
  let currentUrl = url;

  try {
    while (redirectCount <= SNAPSHOT_MAX_REDIRECTS) {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": SNAPSHOT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "manual", // Handle redirects manually for SSRF check
      });

      // Handle redirects manually to validate each redirect URL
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, reason: "fetch_error", message: "Redirect without Location header" };
        }

        // Resolve relative redirects
        const redirectUrl = new URL(location, currentUrl).toString();

        // Check redirect URL for SSRF
        const redirectCheck = isUrlSafe(redirectUrl);
        if (!redirectCheck.safe) {
          return {
            ok: false,
            reason: redirectCheck.reason!,
            message: `Redirect to blocked URL: ${redirectCheck.message}`,
          };
        }

        currentUrl = redirectUrl;
        redirectCount++;
        continue;
      }

      // Check response status
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          return { ok: false, reason: "forbidden", message: `HTTP ${response.status}` };
        }
        return { ok: false, reason: "fetch_error", message: `HTTP ${response.status}` };
      }

      // Check content type
      const contentType = response.headers.get("content-type") || "";
      const isHtml = SNAPSHOT_ALLOWED_CONTENT_TYPES.some((allowed) =>
        contentType.toLowerCase().includes(allowed)
      );
      if (!isHtml) {
        return { ok: false, reason: "not_html", message: `Content-Type: ${contentType}` };
      }

      // Check content length if available
      const contentLength = response.headers.get("content-length");
      if (contentLength && Number.parseInt(contentLength, 10) > SNAPSHOT_MAX_CONTENT_SIZE) {
        return { ok: false, reason: "too_large", message: `Content-Length: ${contentLength}` };
      }

      // Read response with size limit
      const reader = response.body?.getReader();
      if (!reader) {
        return { ok: false, reason: "fetch_error", message: "No response body" };
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;
        if (totalSize > SNAPSHOT_MAX_CONTENT_SIZE) {
          reader.cancel();
          return {
            ok: false,
            reason: "too_large",
            message: `Response exceeded ${SNAPSHOT_MAX_CONTENT_SIZE} bytes`,
          };
        }
        chunks.push(value);
      }

      // Combine chunks and decode
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder("utf-8", { fatal: false });
      const html = decoder.decode(combined);

      // Build headers map
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      return {
        ok: true,
        html,
        finalUrl: currentUrl,
        contentType,
        headers,
      };
    }

    return {
      ok: false,
      reason: "fetch_error",
      message: `Too many redirects (${SNAPSHOT_MAX_REDIRECTS})`,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          ok: false,
          reason: "timeout",
          message: `Request timed out after ${SNAPSHOT_FETCH_TIMEOUT_MS}ms`,
        };
      }
      return { ok: false, reason: "fetch_error", message: error.message };
    }
    return { ok: false, reason: "fetch_error", message: "Unknown fetch error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if the page has noarchive directive (in headers or HTML)
 */
export function checkNoArchive(headers: Record<string, string>, html: string): boolean {
  // Check X-Robots-Tag header
  const robotsTag = headers["x-robots-tag"] || "";
  if (robotsTag.toLowerCase().includes("noarchive")) {
    return true;
  }

  // Check meta robots tag in HTML (basic check - will be more thorough after parsing)
  const metaRobotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]*>/gi);
  if (metaRobotsMatch) {
    for (const match of metaRobotsMatch) {
      if (match.toLowerCase().includes("noarchive")) {
        return true;
      }
    }
  }

  return false;
}
