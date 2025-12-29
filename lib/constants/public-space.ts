/**
 * Public space configuration constants.
 * Centralizes policy values and markers used across public space handling.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React)
 * to ensure it can be safely imported anywhere including edge middleware.
 */

/**
 * Prefix used in x-space-slug header to indicate a custom domain.
 * Format: "custom:domain.com"
 */
export const CUSTOM_DOMAIN_PREFIX = "custom:";

/**
 * Default limit for public saves list queries
 */
export const PUBLIC_LIST_LIMIT = 50;

/**
 * Cache duration in seconds for RSS feed responses
 */
export const PUBLIC_RSS_CACHE_SECONDS = 3600;

/**
 * Maximum limit for public saves list queries (Zod validation)
 */
export const PUBLIC_LIST_MAX_LIMIT = 50;

/**
 * Minimum limit for public saves list queries (Zod validation)
 */
export const PUBLIC_LIST_MIN_LIMIT = 1;

/**
 * Default limit for public saves list queries (Zod default)
 */
export const PUBLIC_LIST_DEFAULT_LIMIT = 20;

/**
 * Check if a slug string represents a custom domain
 */
export function isCustomDomainSlug(slug: string): boolean {
  return slug.startsWith(CUSTOM_DOMAIN_PREFIX);
}

/**
 * Extract the domain from a custom domain slug
 */
export function extractCustomDomain(slug: string): string {
  return slug.slice(CUSTOM_DOMAIN_PREFIX.length);
}

/**
 * Create a custom domain slug marker
 */
export function createCustomDomainSlug(domain: string): string {
  return `${CUSTOM_DOMAIN_PREFIX}${domain}`;
}
