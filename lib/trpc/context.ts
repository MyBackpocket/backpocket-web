import { IS_DEVELOPMENT } from "@/lib/config/public";
import type { Space } from "@/lib/types";

// Check if mock auth mode is enabled (only works in development)
const isMockAuthMode = IS_DEVELOPMENT && process.env.BACKPOCKET_AUTH_MODE === "mock";

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Debug logging for auth mode (only in development)
if (IS_DEVELOPMENT) {
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
 * Mobile support:
 * - Clerk's auth() helper automatically reads Authorization: Bearer <token> headers
 * - Mobile apps send JWT tokens via Bearer header, which Clerk validates
 * - No special handling needed - auth() works the same for web cookies and mobile tokens
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
  // Clerk's auth() helper automatically handles:
  // 1. Session cookies from web browser requests
  // 2. Bearer tokens from mobile/API clients via Authorization header
  // Both are validated against Clerk's JWKS
  if (isClerkConfigured) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const authResult = await auth();
      userId = authResult.userId;

      if (IS_DEVELOPMENT && userId) {
        console.log("[auth] Authenticated user:", `${userId.slice(0, 10)}...`);
      }
    } catch (e) {
      // Auth failed - fail closed (userId stays null)
      if (IS_DEVELOPMENT) {
        console.warn("[auth] Clerk auth failed:", e);
      }
    }
  }
  // If Clerk not configured and not in mock mode, userId remains null (fail closed)

  return { userId, spaceCache };
};
