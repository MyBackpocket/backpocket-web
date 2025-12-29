"use client";

import {
  Bookmark,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Pencil,
  Settings,
  Tags,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserButton } from "@/components/auth-components";
import { Logo } from "@/components/logo";
import { QuickAdd } from "@/components/quick-add";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Saves", href: "/app/saves", icon: Bookmark },
  { name: "Collections", href: "/app/collections", icon: FolderOpen },
  { name: "Tags", href: "/app/tags", icon: Tags },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "backpocket.my";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: space, isLoading: spaceLoading } = trpc.space.getMySpace.useQuery();

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
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-denim/15 bg-card transition-transform duration-200 lg:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-denim/15 px-4">
            <Link href="/app" className="flex items-center gap-2">
              <Logo size="md" />
            </Link>
            <button
              type="button"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Add Button */}
          <div className="p-4">
            <QuickAdd />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-denim/10 text-denim-deep"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "text-rust")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-denim/15 p-4">
            <div className="flex items-center gap-3">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Your Space</p>
                {spaceLoading ? (
                  <p className="text-xs text-muted-foreground truncate">Loading...</p>
                ) : space?.slug ? (
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                      {typeof window !== "undefined" && window.location.hostname === "localhost"
                        ? `${space.slug}.localhost:3000`
                        : `${space.slug}.${ROOT_DOMAIN}`}
                    </p>
                    <Link
                      href="/app/settings"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit space URL"
                    >
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/app/settings"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <span>Set up your space</span>
                    <Pencil className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-denim/15 bg-background/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/app" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <div className="ml-auto">
            <UserButton />
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] lg:min-h-screen">{children}</main>
      </div>
    </div>
  );
}
