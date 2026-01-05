import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

// Performance thresholds (ms)
const SLOW_PROCEDURE_THRESHOLD = 200;

// Initialize tRPC with context type and custom error formatter
const t = initTRPC.context<Context>().create({
  errorFormatter: ({ shape, error }) => {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Pass through the cause for custom error data (e.g., duplicate save info)
        cause: error.cause,
      },
    };
  },
});

// Timing middleware for performance monitoring
const timingMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();
  const result = await next();
  const duration = performance.now() - start;

  // Log slow procedures
  if (duration > SLOW_PROCEDURE_THRESHOLD) {
    console.warn(`[tRPC:slow] ${type} ${path} took ${duration.toFixed(1)}ms`);
  } else if (process.env.NODE_ENV === "development") {
    console.log(`[tRPC] ${type} ${path} ${duration.toFixed(1)}ms`);
  }

  return result;
});

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
export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure.use(timingMiddleware).use(isAuthenticated);
