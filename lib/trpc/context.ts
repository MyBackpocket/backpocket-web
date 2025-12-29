import type { Space } from "@/lib/types";

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === "development";

// Check if mock auth mode is enabled (only works in development)
const isMockAuthMode = isDevelopment && process.env.BACKPOCKET_AUTH_MODE === "mock";

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Debug logging for auth mode (only in development)
if (isDevelopment) {
  if (isMockAuthMode) {
    console.log("[auth] 🔧 Mock auth mode enabled (BACKPOCKET_AUTH_MODE=mock)");
  } else if (!isClerkConfigured) {
    console.log(
      "[auth] ⚠️ Clerk not configured and mock mode not enabled. Protected routes will fail."
    );
  }
}

// Request-scoped cache for user space lookups
export type SpaceCache = Map<string, Promise<Space | null>>;

// Context type exported for use in trpc.ts and procedures
export type Context = {
  userId: string | null;
  spaceCache: SpaceCache;
};

/**
 * Creates the tRPC context for each request.
 *
 * Security behavior:
 * - In development with BACKPOCKET_AUTH_MODE=mock: uses "mock-user-dev" as userId
 * - In development without mock mode: uses Clerk if configured, otherwise null (fail closed)
 * - In production/staging: always uses Clerk; if not configured or auth fails, userId is null
 *
 * The spaceCache is request-scoped to avoid cross-request state leakage.
 */
export const createContext = async (): Promise<Context> => {
  let userId: string | null = null;

  // Request-scoped cache (created fresh for each request)
  const spaceCache: SpaceCache = new Map();

  // Dev-only mock auth mode (explicit opt-in)
  if (isMockAuthMode) {
    userId = "mock-user-dev";
    return { userId, spaceCache };
  }

  // Try Clerk authentication
  if (isClerkConfigured) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const authResult = await auth();
      userId = authResult.userId;
    } catch (e) {
      // Auth failed - fail closed (userId stays null)
      if (isDevelopment) {
        console.warn("[auth] Clerk auth failed:", e);
      }
    }
  }
  // If Clerk not configured and not in mock mode, userId remains null (fail closed)

  return { userId, spaceCache };
};
