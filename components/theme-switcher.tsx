"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Returns the appropriate icon component based on the resolved theme.
 * Used to show Sun for light mode and Moon for dark mode.
 */
export function getThemeIcon(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? Moon : Sun;
}

/**
 * Returns the next theme in the cycle: system → light → dark → system
 */
export function getNextTheme(currentTheme: string | undefined): "light" | "dark" | "system" {
  if (currentTheme === "system") return "light";
  if (currentTheme === "light") return "dark";
  return "system";
}

/**
 * Theme switcher with dropdown menu.
 * Uses resolvedTheme for the icon which updates dynamically when theme changes.
 */
export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/hydration, render a skeleton to prevent mismatch and flash
  if (!mounted) {
    return <div className="h-9 w-9 shrink-0" />;
  }

  const ThemeIcon = getThemeIcon(resolvedTheme);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <ThemeIcon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact theme switcher that cycles through themes on click.
 * Uses resolvedTheme for the icon which updates dynamically when theme changes.
 */
export function ThemeSwitcherCompact() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    setTheme(getNextTheme(theme));
  };

  // During SSR/hydration, render a skeleton to prevent mismatch and flash
  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  const ThemeIcon = getThemeIcon(resolvedTheme);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-9 w-9"
      title={`Theme: ${theme}`}
    >
      <ThemeIcon className="h-4 w-4" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
