import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

// Initialize tRPC with context type
const t = initTRPC.context<Context>().create();

// Auth middleware for protected routes
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

// Exports
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
