import { appRouter, createContext } from "./server";

/**
 * Server-side tRPC caller for use in Server Components and Route Handlers.
 * This creates a direct caller that bypasses HTTP.
 */
export async function createCaller() {
  const ctx = await createContext();
  return appRouter.createCaller(ctx);
}
