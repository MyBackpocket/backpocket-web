/**
 * tRPC configuration constants.
 * Centralizes tRPC endpoint path to prevent drift across client/server/middleware.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React)
 * to ensure it can be safely imported anywhere including edge middleware.
 */

/** The base endpoint path for tRPC API routes */
export const TRPC_ENDPOINT = "/api/trpc";
