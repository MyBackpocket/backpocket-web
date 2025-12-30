"use client";

import { useState } from "react";
import type { Space } from "@/lib/types";
import { AppSidebar } from "./app-sidebar";
import { MobileHeader } from "./mobile-header";

interface AppShellProps {
  space: Space | null;
  children: React.ReactNode;
}

/**
 * Client-side shell that manages mobile navigation state.
 * Space data is passed from the server to avoid client-side fetch waterfall.
 */
export function AppShell({ space, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AppSidebar space={space} isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar (mobile) */}
        <MobileHeader onOpenMenu={() => setMobileNavOpen(true)} />

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] lg:min-h-screen">{children}</main>
      </div>
    </div>
  );
}
