import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { APP_DOMAIN, IS_DEVELOPMENT, ROOT_DOMAIN } from "@/lib/config/public";
import { SPACE_SLUG_HEADER } from "@/lib/constants/headers";
import { createCustomDomainSlug } from "@/lib/constants/public-space";
import { routePatterns } from "@/lib/constants/routes";

// Check if we're in development mode with mock auth
const isMockAuthMode = IS_DEVELOPMENT && process.env.BACKPOCKET_AUTH_MODE === "mock";

/**
 * Resolve the Space from the request host.
 * Returns null if this is the primary app domain.
 * Returns the subdomain slug if it's a public space.
 */
function resolveSpaceSlug(host: string): string | null {
  // Remove port for local development
  const hostname = host.split(":")[0];

  // If it's the primary app domain, no space resolution needed
  if (hostname === APP_DOMAIN || hostname === `www.${APP_DOMAIN}`) {
    return null;
  }

  // For localhost (no subdomain), also skip
  if (hostname === "localhost") {
    return null;
  }

  // For Vercel preview deployments, skip subdomain resolution
  if (hostname.endsWith(".vercel.app")) {
    return null;
  }

  // Check for subdomain pattern: {slug}.backpocket.my
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, "");
    // Ignore 'www' subdomain
    if (subdomain && subdomain !== "www") {
      return subdomain;
    }
  }

  // For local development: {slug}.localhost
  if (hostname.endsWith(".localhost") || hostname.includes(".localhost:")) {
    const subdomain = hostname.split(".localhost")[0];
    if (subdomain && subdomain !== "www") {
      return subdomain;
    }
  }

  // Custom domain case: would need to look up in domain_mappings
  // For MVP, we'll treat unknown domains as potential custom domains
  // and let the public space handler resolve them
  if (!hostname.includes(ROOT_DOMAIN) && !hostname.includes("localhost")) {
    // Mark as custom domain resolution needed
    return createCustomDomainSlug(hostname);
  }

  return null;
}

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([routePatterns.app]);

// Routes that are always public (sign-in, sign-up, public spaces)
const _isPublicRoute = createRouteMatcher([
  "/",
  routePatterns.signIn,
  routePatterns.signUp,
  routePatterns.public,
  routePatterns.trpc,
]);

/**
 * Middleware handler.
 *
 * In development with BACKPOCKET_AUTH_MODE=mock:
 * - Protected routes are accessible without Clerk authentication
 * - tRPC context will use "mock-user-dev" as userId
 *
 * In production (or dev without mock mode):
 * - Protected routes require Clerk authentication
 * - Missing/invalid auth returns redirect to sign-in
 */
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const host = request.headers.get("host") || "";
  const spaceSlug = resolveSpaceSlug(host);

  // If we have a space slug, this is a public space request - rewrite to /public
  // But don't rewrite API routes - they need to reach the actual API handlers
  if (spaceSlug) {
    const pathname = request.nextUrl.pathname;

    // Allow API routes to pass through without rewrite
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.next();
      response.headers.set(SPACE_SLUG_HEADER, spaceSlug);
      return response;
    }

    const response = NextResponse.rewrite(new URL(`/public${pathname}`, request.url));
    response.headers.set(SPACE_SLUG_HEADER, spaceSlug);
    return response;
  }

  // In mock auth mode (dev only), skip Clerk protection
  // The tRPC context will handle setting userId to "mock-user-dev"
  if (isMockAuthMode && isProtectedRoute(request)) {
    // Allow access without Clerk - let the request through
    return NextResponse.next();
  }

  // Protect authenticated routes (production behavior)
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
