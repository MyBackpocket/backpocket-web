/**
 * Browser storage key constants (cookies, localStorage, sessionStorage).
 * Centralizes storage keys to prevent conflicts and enable refactoring.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React)
 * to ensure it can be safely imported anywhere.
 */

/** Cookie name for theme preference (cross-subdomain) */
export const THEME_COOKIE_NAME = "bp-theme";

/** Session storage key prefix for tracking space visits */
export const VISITED_SESSION_PREFIX = "visited:";

/**
 * Generate a session storage key for tracking a space visit
 */
export function getVisitedSessionKey(spaceId: string): string {
  return `${VISITED_SESSION_PREFIX}${spaceId}`;
}
