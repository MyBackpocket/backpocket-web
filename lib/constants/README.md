# Constants Directory

This directory contains centralized constants and configuration values used throughout the backpocket application.

## Design Principles

1. **Dependency-Free**: All files in this directory are pure TypeScript/JavaScript with no React, Next.js, or Node-only imports. This ensures they can be safely imported in:
   - Client components (`"use client"`)
   - Server components
   - Edge middleware (`proxy.ts`)
   - API routes

2. **Single Source of Truth**: Each category of constant lives in exactly one file, eliminating duplication and drift.

3. **Type-Safe**: All constants are exported as `const` assertions where appropriate to provide precise typing.

## File Overview

| File | Contents |
|------|----------|
| `dns.ts` | Vercel DNS targets, DNS provider documentation links |
| `headers.ts` | HTTP header names used internally (e.g., `x-space-slug`) |
| `links.ts` | External URLs (marketing, reference links) |
| `public-space.ts` | Custom domain prefix, list limits, cache settings |
| `routes.ts` | Internal route paths, route patterns for middleware, query params |
| `storage.ts` | Cookie names, sessionStorage key prefixes |
| `trpc.ts` | tRPC endpoint path |
| `urls.ts` | URL building helpers for space URLs |

## Usage

```typescript
// Import from individual files for tree-shaking
import { routes } from "@/lib/constants/routes";
import { SPACE_SLUG_HEADER } from "@/lib/constants/headers";

// Or use the barrel export
import { routes, SPACE_SLUG_HEADER, MARKETING_URL } from "@/lib/constants";
```

## Adding New Constants

When adding new constants, consider:

1. **Where does it belong?** Check if an existing file covers the category.
2. **Is it truly constant?** If it varies by environment, put it in `lib/config/public.ts` instead.
3. **Keep it pure.** Don't import `window`, `headers()`, or any runtime-specific APIs.
4. **Add helpers sparingly.** Pure functions that take explicit inputs are fine (e.g., `buildSpaceUrl()`).

## What NOT to Put Here

- **UI copy/labels**: Keep in components unless repeated verbatim across files.
- **Environment-varying config**: Use `lib/config/public.ts` for `process.env.*` values.
- **Server-only secrets**: Those shouldn't be in constants accessible to client code.

## Enforcement (Future)

Consider adding a CI check to flag new occurrences of patterns like:
- `"backpocket.my"` (should use `ROOT_DOMAIN`)
- `"x-space-slug"` (should use `SPACE_SLUG_HEADER`)
- `href="/app` literals (should use `routes.*`)

