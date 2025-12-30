import { createCaller } from "@/lib/trpc/caller";
import { AppShell } from "./_components/app-shell";

// Force dynamic rendering to ensure fresh auth state
export const dynamic = "force-dynamic";

/**
 * Server Component layout for the authenticated app.
 * Fetches space data server-side to eliminate client-side waterfall.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Fetch space data server-side - this eliminates the
  // "layout mounts → fetches space" waterfall on every navigation
  const caller = await createCaller();
  let space = null;
  try {
    space = await caller.space.getMySpace();
  } catch {
    // Space will be null if user doesn't have one yet
    // The shell will handle this gracefully
  }

  return <AppShell space={space}>{children}</AppShell>;
}
