import { createCaller } from "@/lib/trpc/caller";
import type { DomainMapping } from "@/lib/types";
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
  let domains: DomainMapping[] = [];
  try {
    space = await caller.space.getMySpace();
    // Also fetch active custom domains
    const allDomains = await caller.space.listDomains();
    domains = allDomains.filter((d) => d.status === "active");
  } catch {
    // Space will be null if user doesn't have one yet
    // The shell will handle this gracefully
  }

  return (
    <AppShell space={space} domains={domains}>
      {children}
    </AppShell>
  );
}
