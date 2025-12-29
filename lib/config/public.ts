/**
 * Public configuration values backed by environment variables.
 * Safe to import in client, server, and edge runtimes.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React, no Node-only APIs)
 * to ensure it can be safely imported by proxy.ts (edge middleware).
 */

/** Default root domain used when env var is not set */
export const DEFAULT_ROOT_DOMAIN = "backpocket.my";

/** Default app domain used when env var is not set */
export const DEFAULT_APP_DOMAIN = "backpocket.my";

/** Default port for local development */
export const DEFAULT_LOCAL_PORT = 3000;

/**
 * Root domain for public spaces (e.g., backpocket.my for username.backpocket.my)
 * Falls back to DEFAULT_ROOT_DOMAIN if NEXT_PUBLIC_ROOT_DOMAIN is not set.
 */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;

/**
 * Primary app domain (marketing + authenticated app)
 * Falls back to DEFAULT_APP_DOMAIN if NEXT_PUBLIC_APP_DOMAIN is not set.
 */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || DEFAULT_APP_DOMAIN;

/**
 * Whether we're running in development mode
 */
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
