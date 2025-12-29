/**
 * Internal route paths for the application.
 * Centralizes all route strings to prevent drift and enable refactoring.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React)
 * to ensure it can be safely imported anywhere.
 */

/** Main application routes */
export const routes = {
  /** Landing/marketing page */
  home: "/",

  /** Authentication routes */
  signIn: "/sign-in",
  signUp: "/sign-up",

  /** App routes (authenticated) */
  app: {
    root: "/app",
    saves: "/app/saves",
    savesNew: "/app/saves/new",
    save: (id: string) => `/app/saves/${id}`,
    collections: "/app/collections",
    tags: "/app/tags",
    settings: "/app/settings",
  },

  /** Public space routes (served on subdomains) */
  public: {
    root: "/",
    save: (id: string) => `/s/${id}`,
    rss: "/rss.xml",
  },
} as const;

/** Route patterns used for middleware matchers */
export const routePatterns = {
  /** Matches all authenticated app routes */
  app: "/app(.*)",
  /** Matches sign-in routes */
  signIn: "/sign-in(.*)",
  /** Matches sign-up routes */
  signUp: "/sign-up(.*)",
  /** Matches public space routes */
  public: "/public(.*)",
  /** Matches API routes */
  api: "/api(.*)",
  /** Matches tRPC routes */
  trpc: "/api/trpc(.*)",
} as const;

/** Query parameter keys and values */
export const query = {
  /** Filter parameter for saves list */
  filter: {
    key: "filter",
    values: {
      favorites: "favorites",
    },
  },
} as const;

/**
 * Helper to build a saves route with filter query
 */
export function savesWithFilter(filter: keyof typeof query.filter.values): string {
  return `${routes.app.saves}?${query.filter.key}=${query.filter.values[filter]}`;
}
