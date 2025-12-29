"use client";

import { ClerkProvider as BaseClerkProvider } from "@clerk/nextjs";

// Conditionally wrap with Clerk based on environment
export function ClerkProvider({ children }: { children: React.ReactNode }) {
  // If no Clerk key is configured, just render children
  // This allows the app to build and run in development without Clerk
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkKey) {
    return <>{children}</>;
  }

  return <BaseClerkProvider>{children}</BaseClerkProvider>;
}
