import { Moon, Sun } from "lucide-react";
import { describe, expect, it } from "vitest";
import { getNextTheme, getThemeIcon } from "./theme-switcher";

describe("ThemeSwitcher", () => {
  describe("exports", () => {
    it("exports ThemeSwitcher component", async () => {
      const module = await import("./theme-switcher");
      expect(module.ThemeSwitcher).toBeDefined();
      expect(typeof module.ThemeSwitcher).toBe("function");
    });

    it("exports ThemeSwitcherCompact component", async () => {
      const module = await import("./theme-switcher");
      expect(module.ThemeSwitcherCompact).toBeDefined();
      expect(typeof module.ThemeSwitcherCompact).toBe("function");
    });

    it("exports getThemeIcon helper", async () => {
      const module = await import("./theme-switcher");
      expect(module.getThemeIcon).toBeDefined();
      expect(typeof module.getThemeIcon).toBe("function");
    });

    it("exports getNextTheme helper", async () => {
      const module = await import("./theme-switcher");
      expect(module.getNextTheme).toBeDefined();
      expect(typeof module.getNextTheme).toBe("function");
    });
  });

  describe("getThemeIcon", () => {
    it("returns Moon icon for dark theme", () => {
      expect(getThemeIcon("dark")).toBe(Moon);
    });

    it("returns Sun icon for light theme", () => {
      expect(getThemeIcon("light")).toBe(Sun);
    });

    it("returns Sun icon for undefined (default to light)", () => {
      expect(getThemeIcon(undefined)).toBe(Sun);
    });

    it("returns Sun icon for any non-dark value", () => {
      expect(getThemeIcon("system")).toBe(Sun);
      expect(getThemeIcon("")).toBe(Sun);
      expect(getThemeIcon("unknown")).toBe(Sun);
    });

    describe("dynamic icon updates based on resolvedTheme", () => {
      it("shows Sun when system resolves to light", () => {
        // When theme is "system" and OS preference is light,
        // resolvedTheme will be "light" and icon should be Sun
        expect(getThemeIcon("light")).toBe(Sun);
      });

      it("shows Moon when system resolves to dark", () => {
        // When theme is "system" and OS preference is dark,
        // resolvedTheme will be "dark" and icon should be Moon
        expect(getThemeIcon("dark")).toBe(Moon);
      });
    });
  });

  describe("getNextTheme", () => {
    it("cycles from system to light", () => {
      expect(getNextTheme("system")).toBe("light");
    });

    it("cycles from light to dark", () => {
      expect(getNextTheme("light")).toBe("dark");
    });

    it("cycles from dark to system", () => {
      expect(getNextTheme("dark")).toBe("system");
    });

    it("handles undefined as system (returns light)", () => {
      expect(getNextTheme(undefined)).toBe("system");
    });

    it("handles unknown values by returning system", () => {
      expect(getNextTheme("unknown")).toBe("system");
      expect(getNextTheme("")).toBe("system");
    });

    describe("full theme cycle", () => {
      it("completes a full cycle: system → light → dark → system", () => {
        let theme: string | undefined = "system";

        // system → light
        theme = getNextTheme(theme);
        expect(theme).toBe("light");

        // light → dark
        theme = getNextTheme(theme);
        expect(theme).toBe("dark");

        // dark → system
        theme = getNextTheme(theme);
        expect(theme).toBe("system");
      });
    });
  });

  describe("theme icon consistency", () => {
    it("always shows correct icon regardless of theme setting", () => {
      // The icon should always reflect the RESOLVED theme (what's actually displayed)
      // not the theme SETTING (light/dark/system)

      // When resolvedTheme is "light" (either from explicit light or system resolving to light)
      expect(getThemeIcon("light")).toBe(Sun);

      // When resolvedTheme is "dark" (either from explicit dark or system resolving to dark)
      expect(getThemeIcon("dark")).toBe(Moon);
    });
  });
});
