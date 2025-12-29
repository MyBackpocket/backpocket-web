/**
 * HTTP header names used internally.
 * Centralizes header key strings to prevent typos and enable refactoring.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React)
 * to ensure it can be safely imported anywhere including edge middleware.
 */

/**
 * Header set by middleware to pass the resolved space slug to route handlers.
 * Format: "slug" for subdomain, "custom:domain.com" for custom domains.
 */
export const SPACE_SLUG_HEADER = "x-space-slug";
