"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { UserButton } from "@/components/auth-components";
import { Logo } from "@/components/logo";
import { routes } from "@/lib/constants/routes";

interface MobileHeaderProps {
  onOpenMenu: () => void;
}

export function MobileHeader({ onOpenMenu }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-denim/15 bg-background/95 px-4 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        className="text-muted-foreground hover:text-foreground"
      >
        <Menu className="h-6 w-6" />
      </button>
      <Link href={routes.app.root} className="flex items-center gap-2">
        <Logo size="sm" />
      </Link>
      <div className="ml-auto">
        <UserButton />
      </div>
    </header>
  );
}
