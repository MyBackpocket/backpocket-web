/**
 * tRPC Server - Main entrypoint
 *
 * This file is a thin composition layer that re-exports:
 * - createContext (from ./context.ts)
 * - appRouter and AppRouter type (composed from ./routers/*)
 *
 * For implementation details, see:
 * - ./context.ts - Auth context and request-scoped caching
 * - ./trpc.ts - tRPC initialization and procedure definitions
 * - ./routers/* - Domain-specific route handlers
 * - ./services/* - Shared business logic
 */

import { publicRouter } from "./routers/public";
import { spaceRouter } from "./routers/space";
import { router } from "./trpc";

export type { Context } from "./context";
// Re-export context for use in route handlers
export { createContext } from "./context";

// Main app router - composes all sub-routers
export const appRouter = router({
  public: publicRouter,
  space: spaceRouter,
});

export type AppRouter = typeof appRouter;
