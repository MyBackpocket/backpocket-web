/**
 * URL normalization utilities for duplicate detection
 *
 * The goal is to produce a canonical form of URLs so that
 * semantically identical URLs (differing only by tracking params,
 * protocol, www prefix, etc.) are recognized as duplicates.
 */

/**
 * Parameters that are purely for tracking/analytics and don't affect page content.
 * These will be stripped during normalization.
 */
const TRACKING_PARAMS = new Set([
  // UTM (Google Analytics)
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_cid",
  "utm_reader",
  "utm_name",
  "utm_social",
  "utm_social-type",
  // Facebook
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_source",
  "fb_ref",
  // Google Ads / Google
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  // Twitter/X
  "twclid",
  // Microsoft/Bing
  "msclkid",
  // Common referral/source tracking
  "ref",
  "ref_src",
  "ref_url",
  "referer",
  "referrer",
  "source",
  "src",
  // Mailchimp
  "mc_cid",
  "mc_eid",
  // HubSpot
  "_hsenc",
  "_hsmi",
  "hsa_acc",
  "hsa_cam",
  "hsa_grp",
  "hsa_ad",
  "hsa_src",
  "hsa_tgt",
  "hsa_kw",
  "hsa_mt",
  "hsa_net",
  "hsa_ver",
  // Google Analytics cookies
  "_ga",
  "_gl",
  "_gac",
  // Drip
  "__s",
  // Marketo
  "mkt_tok",
  // Vero
  "vero_id",
  "vero_conv",
  // Newsletter/email tracking
  "nr_email_referer",
  "oly_enc_id",
  "oly_anon_id",
  // Iterable
  "itm_source",
  "itm_medium",
  "itm_campaign",
  // Sailthru
  "stn",
  // Adobe Analytics
  "s_kwcid",
  "ef_id",
  // Reddit
  "rdt_cid",
  // TikTok
  "ttclid",
  // Snapchat
  "sccid",
  "scid",
  // Pinterest
  "epik",
  // LinkedIn
  "li_fat_id",
  // Yahoo
  "guccounter",
  "guce_referrer",
  "guce_referrer_sig",
  // Generic tracking
  "trk",
  "tracking",
  "campaign",
  "affiliate",
  "partner",
  // Session/cache busters
  "_",
  "nocache",
  "cachebuster",
  "timestamp",
  "cb",
  "rand",
  "random",
]);

/**
 * Site-specific parameters that should be preserved as they affect content.
 * This is a safeguard - if a param is in this list, it won't be stripped
 * even if it somehow ends up in TRACKING_PARAMS.
 */
const CONTENT_PARAMS = new Set([
  // YouTube
  "v", // video ID
  "t", // timestamp
  "list", // playlist
  "index", // playlist index
  // Search engines
  "q", // query
  "query",
  "search",
  "s",
  // Pagination
  "page",
  "p",
  "offset",
  "limit",
  // Filters/sorting
  "sort",
  "order",
  "filter",
  "category",
  "tag",
  "type",
  // Common content identifiers
  "id",
  "article",
  "post",
  "tab",
  "section",
  // E-commerce
  "product",
  "sku",
  "variant",
  "size",
  "color",
]);

/**
 * Checks if a query parameter should be stripped (is tracking-only)
 */
function isTrackingParam(param: string): boolean {
  const lower = param.toLowerCase();
  // Preserve content-affecting params
  if (CONTENT_PARAMS.has(lower)) {
    return false;
  }
  // Strip known tracking params
  if (TRACKING_PARAMS.has(lower)) {
    return true;
  }
  // Strip params that look like tracking (common patterns)
  if (
    lower.startsWith("utm_") ||
    lower.startsWith("hsa_") ||
    lower.startsWith("itm_") ||
    lower.startsWith("fb_") ||
    lower.startsWith("mc_") ||
    lower.endsWith("_id") ||
    lower.endsWith("clid")
  ) {
    return true;
  }
  return false;
}

/**
 * Normalizes a URL for duplicate detection.
 *
 * Transformations applied:
 * 1. Parse and validate URL
 * 2. Lowercase hostname
 * 3. Remove www. prefix
 * 4. Remove default ports (80 for http, 443 for https)
 * 5. Strip tracking/analytics query parameters
 * 6. Sort remaining query parameters alphabetically
 * 7. Remove empty query parameters
 * 8. Remove trailing slash from path (unless path is just "/")
 * 9. Remove hash/fragment (unless it's a SPA route indicator)
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string, or null if URL is invalid
 */
export function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only handle http(s) URLs
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Lowercase hostname and remove www.
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    // Remove default ports
    let port = parsed.port;
    if (
      (parsed.protocol === "http:" && port === "80") ||
      (parsed.protocol === "https:" && port === "443")
    ) {
      port = "";
    }

    // Process query parameters
    const params = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      // Skip tracking params and empty values
      if (!isTrackingParam(key) && value !== "") {
        params.set(key, value);
      }
    }

    // Sort parameters alphabetically for consistent ordering
    params.sort();

    // Normalize path: remove trailing slash unless it's the root
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    // Decode percent-encoded characters that don't need encoding
    // This normalizes URLs like /path%2Fto/page to /path/to/page
    try {
      path = decodeURIComponent(path);
      // Re-encode only what's necessary
      path = path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    } catch {
      // If decode fails, keep original path
    }

    // Build normalized URL
    const portSuffix = port ? `:${port}` : "";
    const querySuffix = params.toString() ? `?${params.toString()}` : "";

    // Note: We intentionally drop the hash/fragment for dedup purposes
    // since fragments typically don't change server content
    return `${parsed.protocol}//${hostname}${portSuffix}${path}${querySuffix}`;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Extracts the domain from a URL for display purposes.
 *
 * @param url - The URL to extract domain from
 * @returns Domain string (without www.), or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Checks if two URLs point to the same content (after normalization).
 *
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns true if URLs normalize to the same value
 */
export function urlsMatch(url1: string, url2: string): boolean {
  const normalized1 = normalizeUrl(url1);
  const normalized2 = normalizeUrl(url2);

  if (!normalized1 || !normalized2) {
    return false;
  }

  return normalized1 === normalized2;
}
