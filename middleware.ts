import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Primary app domain (marketing + authenticated app)
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "backpocket.my";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "backpocket.my";

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
    return `custom:${hostname}`;
  }

  return null;
}

// Routes that require authentication
const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

// Routes that are always public (sign-in, sign-up, public spaces)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/public(.*)",
  "/api/trpc(.*)",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const host = request.headers.get("host") || "";
  const spaceSlug = resolveSpaceSlug(host);

  // If we have a space slug, this is a public space request - rewrite to /public
  if (spaceSlug) {
    const response = NextResponse.rewrite(
      new URL(`/public${request.nextUrl.pathname}`, request.url)
    );
    response.headers.set("x-space-slug", spaceSlug);
    return response;
  }

  // Protect authenticated routes
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
