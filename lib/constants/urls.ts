/**
 * URL building utilities for consistent URL generation.
 * Handles the localhost vs production logic in one place.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React, no window access)
 * to ensure it can be safely imported anywhere. Functions accept explicit inputs
 * rather than reading from globals.
 */

import { DEFAULT_LOCAL_PORT, DEFAULT_ROOT_DOMAIN } from "../config/public";

export interface SpaceUrlOptions {
  /** The space slug */
  slug: string;
  /** The root domain (e.g., "backpocket.my") */
  rootDomain?: string;
  /** Whether we're on localhost */
  isLocalhost?: boolean;
  /** Local port (default: 3000) */
  localPort?: number;
}

/**
 * Build a full URL for a public space.
 * Returns http://slug.localhost:3000 in dev, https://slug.domain.com in prod.
 */
export function buildSpaceUrl(options: SpaceUrlOptions): string {
  const {
    slug,
    rootDomain = DEFAULT_ROOT_DOMAIN,
    isLocalhost = false,
    localPort = DEFAULT_LOCAL_PORT,
  } = options;

  if (isLocalhost) {
    return `http://${slug}.localhost:${localPort}`;
  }

  return `https://${slug}.${rootDomain}`;
}

/**
 * Build a display hostname for a public space (without protocol).
 * Returns slug.localhost:3000 in dev, slug.domain.com in prod.
 */
export function buildSpaceHostname(options: SpaceUrlOptions): string {
  const {
    slug,
    rootDomain = DEFAULT_ROOT_DOMAIN,
    isLocalhost = false,
    localPort = DEFAULT_LOCAL_PORT,
  } = options;

  if (isLocalhost) {
    return `${slug}.localhost:${localPort}`;
  }

  return `${slug}.${rootDomain}`;
}

/**
 * Check if the current hostname is localhost (for use in client components).
 * Pass in window.location.hostname or similar.
 */
export function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

/**
 * Build the base URL for the app (used by tRPC client).
 * - Browser: returns empty string (relative URLs)
 * - Vercel: returns https://VERCEL_URL
 * - Local: returns http://localhost:3000
 */
export function getBaseUrl(options: {
  isBrowser: boolean;
  vercelUrl?: string;
  localPort?: number;
}): string {
  const { isBrowser, vercelUrl, localPort = DEFAULT_LOCAL_PORT } = options;

  if (isBrowser) return "";
  if (vercelUrl) return `https://${vercelUrl}`;
  return `http://localhost:${localPort}`;
}
