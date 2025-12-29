/**
 * External link constants used across the application.
 * Centralizes marketing URLs and reference links.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React)
 * to ensure it can be safely imported anywhere.
 */

/** Canonical marketing/home URL for backpocket */
export const MARKETING_URL = "https://backpocket.my";

/** External reference links */
export const externalLinks = {
  /** Mozilla's Pocket shutdown announcement */
  pocketShutdown: "https://support.mozilla.org/en-US/kb/future-of-pocket",
} as const;
