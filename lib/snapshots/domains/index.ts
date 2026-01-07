/**
 * Domain-specific extractor registry
 *
 * Provides specialized content extractors for domains that don't work well
 * with Mozilla Readability (Twitter, Instagram, TikTok, etc.)
 */

import type { SnapshotContent } from "@/lib/types";
import { extractReddit, isRedditUrl } from "./reddit";
import { extractTweet, isTwitterUrl } from "./twitter";

export type DomainExtractor = (url: string) => Promise<SnapshotContent | null>;

interface DomainHandler {
  matcher: (url: string) => boolean;
  extractor: DomainExtractor;
}

/**
 * Registry of domain-specific extractors
 * Order matters - first match wins
 */
const DOMAIN_HANDLERS: DomainHandler[] = [
  {
    matcher: isTwitterUrl,
    extractor: extractTweet,
  },
  {
    matcher: isRedditUrl,
    extractor: extractReddit,
  },
  // Future handlers can be added here:
  // { matcher: isInstagramUrl, extractor: extractInstagram },
  // { matcher: isTikTokUrl, extractor: extractTikTok },
];

/**
 * Get a domain-specific extractor for a URL, if one exists
 * Returns null if no specialized handler is registered for this domain
 */
export function getDomainExtractor(url: string): DomainExtractor | null {
  for (const handler of DOMAIN_HANDLERS) {
    if (handler.matcher(url)) {
      return handler.extractor;
    }
  }
  return null;
}

/**
 * Check if a URL has a domain-specific extractor available
 */
export function hasDomainExtractor(url: string): boolean {
  return getDomainExtractor(url) !== null;
}

// Re-export individual extractors for direct use if needed
export { extractReddit, isRedditUrl } from "./reddit";
export { extractTweet, isTwitterUrl } from "./twitter";
