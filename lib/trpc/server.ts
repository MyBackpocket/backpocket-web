import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import {
  filterSaves,
  getPublicSaves,
  getPublicSpace,
  mockCollections,
  mockSaves,
  mockSpace,
  mockTags,
  mockVisitCount,
} from "@/lib/mock-data";

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Create tRPC context
export const createContext = async () => {
  let userId: string | null = null;

  if (isClerkConfigured) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const authResult = await auth();
      userId = authResult.userId;
    } catch (e) {
      // Clerk not configured or error, continue without auth
      console.warn("Clerk auth failed:", e);
    }
  } else {
    // When Clerk is not configured, use a mock user for development
    userId = "mock-user-dev";
  }

  return { userId };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

// Middleware for protected routes
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  // In development without Clerk, allow access with mock user
  if (!isClerkConfigured && ctx.userId === "mock-user-dev") {
    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    });
  }

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

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);

// Public router (no auth required)
const publicRouter = router({
  resolveSpaceByHost: publicProcedure.input(z.object({ host: z.string() })).query(({ input }) => {
    // For MVP, return mock space if host matches
    const slug = input.host.split(".")[0];
    if (slug === mockSpace.slug || input.host.includes("localhost")) {
      return getPublicSpace();
    }
    return null;
  }),

  listPublicSaves: publicProcedure
    .input(
      z.object({
        spaceId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(({ input }) => {
      const saves = getPublicSaves();
      return {
        items: saves.slice(0, input.limit),
        nextCursor: null,
      };
    }),

  getPublicSave: publicProcedure
    .input(z.object({ spaceId: z.string(), saveId: z.string() }))
    .query(({ input }) => {
      const save = mockSaves.find(
        (s) => s.id === input.saveId && (s.visibility === "public" || s.visibility === "unlisted")
      );
      if (!save) return null;
      return {
        id: save.id,
        url: save.url,
        title: save.title,
        description: save.description,
        siteName: save.siteName,
        imageUrl: save.imageUrl,
        savedAt: save.savedAt,
        tags: save.tags?.map((t) => t.name),
      };
    }),

  registerVisit: publicProcedure
    .input(z.object({ spaceId: z.string(), path: z.string() }))
    .mutation(() => {
      // In real implementation, increment Redis counter
      return { ok: true };
    }),

  getVisitCount: publicProcedure.input(z.object({ spaceId: z.string() })).query(() => {
    return {
      total: mockVisitCount,
      asOf: new Date().toISOString(),
    };
  }),
});

// Space router (auth required)
const spaceRouter = router({
  getMySpace: protectedProcedure.query(() => {
    return mockSpace;
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        avatarUrl: z.string().optional(),
        visibility: z.enum(["public", "private"]).optional(),
        publicLayout: z.enum(["list", "grid"]).optional(),
      })
    )
    .mutation(({ input }) => {
      // In real implementation, update database
      return { ...mockSpace, ...input };
    }),

  // Saves
  listSaves: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        visibility: z.enum(["private", "public", "unlisted"]).optional(),
        isArchived: z.boolean().optional(),
        isFavorite: z.boolean().optional(),
        collectionId: z.string().optional(),
        tagId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(({ input }) => {
      const saves = filterSaves(input);
      return {
        items: saves.slice(0, input.limit),
        nextCursor: null,
      };
    }),

  getSave: protectedProcedure.input(z.object({ saveId: z.string() })).query(({ input }) => {
    return mockSaves.find((s) => s.id === input.saveId) || null;
  }),

  createSave: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        visibility: z.enum(["private", "public", "unlisted"]).default("private"),
        collectionIds: z.array(z.string()).optional(),
        tagNames: z.array(z.string()).optional(),
        note: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      // In real implementation, create in database
      const newSave = {
        id: `save-${Date.now()}`,
        spaceId: mockSpace.id,
        url: input.url,
        title: input.title || input.url,
        description: null,
        siteName: null,
        imageUrl: null,
        contentType: "article",
        visibility: input.visibility,
        isArchived: false,
        isFavorite: false,
        createdBy: "user-1",
        savedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        collections: [],
      };
      return newSave;
    }),

  updateSave: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        visibility: z.enum(["private", "public", "unlisted"]).optional(),
        collectionIds: z.array(z.string()).optional(),
        tagNames: z.array(z.string()).optional(),
      })
    )
    .mutation(({ input }) => {
      const save = mockSaves.find((s) => s.id === input.id);
      if (!save) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ...save, ...input };
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ saveId: z.string(), value: z.boolean().optional() }))
    .mutation(({ input }) => {
      const save = mockSaves.find((s) => s.id === input.saveId);
      if (!save) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const newValue = input.value ?? !save.isFavorite;
      return { ...save, isFavorite: newValue };
    }),

  toggleArchive: protectedProcedure
    .input(z.object({ saveId: z.string(), value: z.boolean().optional() }))
    .mutation(({ input }) => {
      const save = mockSaves.find((s) => s.id === input.saveId);
      if (!save) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const newValue = input.value ?? !save.isArchived;
      return { ...save, isArchived: newValue };
    }),

  deleteSave: protectedProcedure.input(z.object({ saveId: z.string() })).mutation(({ input }) => {
    return { success: true, id: input.saveId };
  }),

  // Collections
  listCollections: protectedProcedure.query(() => {
    return mockCollections;
  }),

  createCollection: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        visibility: z.enum(["private", "public"]).default("private"),
      })
    )
    .mutation(({ input }) => {
      return {
        id: `col-${Date.now()}`,
        spaceId: mockSpace.id,
        name: input.name,
        visibility: input.visibility,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { saves: 0 },
      };
    }),

  updateCollection: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        visibility: z.enum(["private", "public"]).optional(),
      })
    )
    .mutation(({ input }) => {
      const collection = mockCollections.find((c) => c.id === input.id);
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ...collection, ...input };
    }),

  deleteCollection: protectedProcedure
    .input(z.object({ collectionId: z.string() }))
    .mutation(({ input }) => {
      return { success: true, id: input.collectionId };
    }),

  // Tags
  listTags: protectedProcedure.query(() => {
    return mockTags;
  }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(({ input }) => {
      return {
        id: `tag-${Date.now()}`,
        spaceId: mockSpace.id,
        name: input.name.toLowerCase(),
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { saves: 0 },
      };
    }),

  updateTag: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(({ input }) => {
      const tag = mockTags.find((t) => t.id === input.id);
      if (!tag) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ...tag, name: input.name };
    }),

  deleteTag: protectedProcedure.input(z.object({ tagId: z.string() })).mutation(({ input }) => {
    return { success: true, id: input.tagId };
  }),

  // Stats
  getStats: protectedProcedure.query(() => {
    return {
      totalSaves: mockSaves.length,
      publicSaves: mockSaves.filter((s) => s.visibility === "public").length,
      privateSaves: mockSaves.filter((s) => s.visibility === "private").length,
      favorites: mockSaves.filter((s) => s.isFavorite).length,
      archived: mockSaves.filter((s) => s.isArchived).length,
      collections: mockCollections.length,
      tags: mockTags.length,
      visitCount: mockVisitCount,
    };
  }),
});

// Main app router
export const appRouter = router({
  public: publicRouter,
  space: spaceRouter,
});

export type AppRouter = typeof appRouter;
