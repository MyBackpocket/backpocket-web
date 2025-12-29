import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { supabaseAdmin } from "@/lib/supabase";
import { getVisitCount, incrementVisitCount } from "@/lib/redis";
import type { Collection, PublicSave, PublicSpace, Save, Space, Tag } from "@/lib/types";

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

// Request-scoped cache for getUserSpace to avoid redundant DB calls
// Each batched tRPC request creates a new cache
const spaceCache = new Map<string, Promise<Space | null>>();

// Debug logging for cache hits (only in development)
const DEBUG_CACHE = process.env.NODE_ENV === "development";

// Helper to get user's space (cached per-request)
async function getUserSpace(userId: string): Promise<Space | null> {
  // Check cache first
  const cached = spaceCache.get(userId);
  if (cached) {
    if (DEBUG_CACHE) console.log(`[spaceCache] ✅ HIT for user ${userId.slice(0, 8)}...`);
    return cached;
  }

  if (DEBUG_CACHE) console.log(`[spaceCache] ❌ MISS for user ${userId.slice(0, 8)}... fetching from DB`);

  // Create the promise and cache it immediately (before awaiting)
  const promise = fetchUserSpaceFromDB(userId);
  spaceCache.set(userId, promise);

  // Clean up cache after request completes (simple TTL)
  promise.finally(() => {
    setTimeout(() => spaceCache.delete(userId), 100);
  });

  return promise;
}

// Actual DB fetch (separated from caching logic)
async function fetchUserSpaceFromDB(userId: string): Promise<Space | null> {
  const start = DEBUG_CACHE ? performance.now() : 0;
  
  // Single query with join instead of 2 sequential queries
  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("space_id, spaces(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!membership || !membership.spaces) {
    if (DEBUG_CACHE) console.log(`[spaceCache] DB query took ${(performance.now() - start).toFixed(1)}ms (no space found)`);
    return null;
  }

  const space = membership.spaces as {
    id: string;
    type: string;
    slug: string;
    name: string;
    bio: string | null;
    avatar_url: string | null;
    visibility: string;
    public_layout: string;
    created_at: string;
    updated_at: string;
  };

  if (DEBUG_CACHE) console.log(`[spaceCache] DB query took ${(performance.now() - start).toFixed(1)}ms`);

  return {
    id: space.id,
    type: space.type as "personal" | "team",
    slug: space.slug,
    name: space.name,
    bio: space.bio,
    avatarUrl: space.avatar_url,
    visibility: space.visibility as "public" | "private",
    publicLayout: space.public_layout as "list" | "grid",
    createdAt: new Date(space.created_at),
    updatedAt: new Date(space.updated_at),
  };
}

// Helper to create a space for new users
async function createSpaceForUser(userId: string): Promise<Space> {
  // Generate a unique slug based on timestamp
  const slug = `user-${Date.now().toString(36)}`;

  const { data: space, error: spaceError } = await supabaseAdmin
    .from("spaces")
    .insert({
      type: "personal",
      slug,
      name: "My Collection",
      visibility: "public",
      public_layout: "grid",
    })
    .select()
    .single();

  if (spaceError || !space) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create space",
    });
  }

  // Create membership
  await supabaseAdmin.from("memberships").insert({
    space_id: space.id,
    user_id: userId,
    role: "owner",
    status: "active",
  });

  return {
    id: space.id,
    type: space.type,
    slug: space.slug,
    name: space.name,
    bio: space.bio,
    avatarUrl: space.avatar_url,
    visibility: space.visibility,
    publicLayout: space.public_layout,
    createdAt: new Date(space.created_at),
    updatedAt: new Date(space.updated_at),
  };
}

// Helper to transform DB save to Save type
function transformSave(
  dbSave: Record<string, unknown>,
  tags: Tag[] = [],
  collections: Collection[] = []
): Save {
  return {
    id: dbSave.id as string,
    spaceId: dbSave.space_id as string,
    url: dbSave.url as string,
    title: dbSave.title as string | null,
    description: dbSave.description as string | null,
    siteName: dbSave.site_name as string | null,
    imageUrl: dbSave.image_url as string | null,
    contentType: dbSave.content_type as string | null,
    visibility: dbSave.visibility as "private" | "public" | "unlisted",
    isArchived: dbSave.is_archived as boolean,
    isFavorite: dbSave.is_favorite as boolean,
    createdBy: dbSave.created_by as string,
    savedAt: new Date(dbSave.saved_at as string),
    createdAt: new Date(dbSave.created_at as string),
    updatedAt: new Date(dbSave.updated_at as string),
    tags,
    collections,
  };
}

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
  resolveSpaceByHost: publicProcedure
    .input(z.object({ host: z.string() }))
    .query(async ({ input }) => {
      // Extract slug from host
      const hostname = input.host.split(":")[0];
      let slug: string | null = null;

      // Check for subdomain pattern
      if (hostname.endsWith(".localhost")) {
        slug = hostname.split(".localhost")[0];
      } else if (hostname.includes(".")) {
        // Subdomain of main domain
        slug = hostname.split(".")[0];
      }

      if (!slug || slug === "www") {
        return null;
      }

      const { data: space } = await supabaseAdmin
        .from("spaces")
        .select("*")
        .eq("slug", slug)
        .eq("visibility", "public")
        .single();

      if (!space) return null;

      const visitCount = await getVisitCount(space.id);

      const result: PublicSpace = {
        id: space.id,
        slug: space.slug,
        name: space.name,
        bio: space.bio,
        avatarUrl: space.avatar_url,
        publicLayout: space.public_layout,
        visitCount,
      };

      return result;
    }),

  listPublicSaves: publicProcedure
    .input(
      z.object({
        spaceId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      let query = supabaseAdmin
        .from("saves")
        .select("*")
        .eq("space_id", input.spaceId)
        .in("visibility", ["public", "unlisted"])
        .eq("is_archived", false)
        .order("saved_at", { ascending: false })
        .limit(input.limit + 1);

      if (input.cursor) {
        query = query.lt("saved_at", input.cursor);
      }

      const { data: saves } = await query;

      if (!saves) {
        return { items: [], nextCursor: null };
      }

      // Get tags for all saves
      const saveIds = saves.slice(0, input.limit).map((s) => s.id);
      const { data: saveTags } = await supabaseAdmin
        .from("save_tags")
        .select("save_id, tags(id, name)")
        .in("save_id", saveIds);

      const tagsByaSaveId = new Map<string, string[]>();
      for (const st of saveTags || []) {
        const tags = tagsByaSaveId.get(st.save_id) || [];
        if (st.tags && typeof st.tags === "object" && "name" in st.tags) {
          tags.push((st.tags as { name: string }).name);
        }
        tagsByaSaveId.set(st.save_id, tags);
      }

      const items: PublicSave[] = saves.slice(0, input.limit).map((save) => ({
        id: save.id,
        url: save.url,
        title: save.title,
        description: save.description,
        siteName: save.site_name,
        imageUrl: save.image_url,
        savedAt: new Date(save.saved_at),
        tags: tagsByaSaveId.get(save.id),
      }));

      const hasMore = saves.length > input.limit;
      const nextCursor = hasMore ? saves[input.limit - 1].saved_at : null;

      return { items, nextCursor };
    }),

  getPublicSave: publicProcedure
    .input(z.object({ spaceId: z.string(), saveId: z.string() }))
    .query(async ({ input }) => {
      const { data: save } = await supabaseAdmin
        .from("saves")
        .select("*")
        .eq("id", input.saveId)
        .eq("space_id", input.spaceId)
        .in("visibility", ["public", "unlisted"])
        .single();

      if (!save) return null;

      // Get tags
      const { data: saveTags } = await supabaseAdmin
        .from("save_tags")
        .select("tags(name)")
        .eq("save_id", save.id);

      const tags = saveTags
        ?.map((st) =>
          st.tags && typeof st.tags === "object" && "name" in st.tags
            ? (st.tags as { name: string }).name
            : null
        )
        .filter(Boolean) as string[];

      return {
        id: save.id,
        url: save.url,
        title: save.title,
        description: save.description,
        siteName: save.site_name,
        imageUrl: save.image_url,
        savedAt: new Date(save.saved_at),
        tags,
      };
    }),

  registerVisit: publicProcedure
    .input(z.object({ spaceId: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await incrementVisitCount(input.spaceId);
      return { ok: true };
    }),

  getVisitCount: publicProcedure
    .input(z.object({ spaceId: z.string() }))
    .query(async ({ input }) => {
      const total = await getVisitCount(input.spaceId);
      return {
        total,
        asOf: new Date().toISOString(),
      };
    }),
});

// Space router (auth required)
const spaceRouter = router({
  getMySpace: protectedProcedure.query(async ({ ctx }) => {
    let space = await getUserSpace(ctx.userId);

    // Create space if user doesn't have one
    if (!space) {
      space = await createSpaceForUser(ctx.userId);
    }

    return space;
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
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.bio !== undefined) updateData.bio = input.bio;
      if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;
      if (input.publicLayout !== undefined) updateData.public_layout = input.publicLayout;

      const { data: updated, error } = await supabaseAdmin
        .from("spaces")
        .update(updateData)
        .eq("id", space.id)
        .select()
        .single();

      if (error || !updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update" });
      }

      return {
        ...space,
        ...input,
      };
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
    .query(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        return { items: [], nextCursor: null };
      }

      let query = supabaseAdmin
        .from("saves")
        .select("*")
        .eq("space_id", space.id)
        .order("saved_at", { ascending: false })
        .limit(input.limit + 1);

      if (input.visibility) {
        query = query.eq("visibility", input.visibility);
      }
      if (input.isArchived !== undefined) {
        query = query.eq("is_archived", input.isArchived);
      }
      if (input.isFavorite !== undefined) {
        query = query.eq("is_favorite", input.isFavorite);
      }
      if (input.query) {
        query = query.or(
          `title.ilike.%${input.query}%,description.ilike.%${input.query}%,url.ilike.%${input.query}%`
        );
      }
      if (input.cursor) {
        query = query.lt("saved_at", input.cursor);
      }

      // Handle collection filter
      if (input.collectionId) {
        const { data: collectionSaves } = await supabaseAdmin
          .from("save_collections")
          .select("save_id")
          .eq("collection_id", input.collectionId);

        const saveIds = collectionSaves?.map((cs) => cs.save_id) || [];
        if (saveIds.length === 0) {
          return { items: [], nextCursor: null };
        }
        query = query.in("id", saveIds);
      }

      // Handle tag filter
      if (input.tagId) {
        const { data: tagSaves } = await supabaseAdmin
          .from("save_tags")
          .select("save_id")
          .eq("tag_id", input.tagId);

        const saveIds = tagSaves?.map((ts) => ts.save_id) || [];
        if (saveIds.length === 0) {
          return { items: [], nextCursor: null };
        }
        query = query.in("id", saveIds);
      }

      const { data: saves } = await query;

      if (!saves || saves.length === 0) {
        return { items: [], nextCursor: null };
      }

      // Get tags and collections for all saves
      const saveIds = saves.slice(0, input.limit).map((s) => s.id);

      const [{ data: saveTags }, { data: saveCollections }] = await Promise.all([
        supabaseAdmin.from("save_tags").select("save_id, tags(*)").in("save_id", saveIds),
        supabaseAdmin
          .from("save_collections")
          .select("save_id, collections(*)")
          .in("save_id", saveIds),
      ]);

      const tagsBySaveId = new Map<string, Tag[]>();
      for (const st of saveTags || []) {
        const tags = tagsBySaveId.get(st.save_id) || [];
        if (st.tags && typeof st.tags === "object" && !Array.isArray(st.tags)) {
          const tag = st.tags as unknown as Record<string, unknown>;
          tags.push({
            id: tag.id as string,
            spaceId: tag.space_id as string,
            name: tag.name as string,
            createdAt: new Date(tag.created_at as string),
            updatedAt: new Date(tag.updated_at as string),
          });
        }
        tagsBySaveId.set(st.save_id, tags);
      }

      const collectionsBySaveId = new Map<string, Collection[]>();
      for (const sc of saveCollections || []) {
        const collections = collectionsBySaveId.get(sc.save_id) || [];
        if (
          sc.collections &&
          typeof sc.collections === "object" &&
          !Array.isArray(sc.collections)
        ) {
          const col = sc.collections as unknown as Record<string, unknown>;
          collections.push({
            id: col.id as string,
            spaceId: col.space_id as string,
            name: col.name as string,
            visibility: col.visibility as "private" | "public",
            createdAt: new Date(col.created_at as string),
            updatedAt: new Date(col.updated_at as string),
          });
        }
        collectionsBySaveId.set(sc.save_id, collections);
      }

      const items = saves
        .slice(0, input.limit)
        .map((save) =>
          transformSave(
            save,
            tagsBySaveId.get(save.id) || [],
            collectionsBySaveId.get(save.id) || []
          )
        );

      const hasMore = saves.length > input.limit;
      const nextCursor = hasMore ? saves[input.limit - 1].saved_at : null;

      return { items, nextCursor };
    }),

  getSave: protectedProcedure
    .input(z.object({ saveId: z.string() }))
    .query(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) return null;

      const { data: save } = await supabaseAdmin
        .from("saves")
        .select("*")
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .single();

      if (!save) return null;

      // Get tags and collections
      const [{ data: saveTags }, { data: saveCollections }] = await Promise.all([
        supabaseAdmin.from("save_tags").select("tags(*)").eq("save_id", save.id),
        supabaseAdmin.from("save_collections").select("collections(*)").eq("save_id", save.id),
      ]);

      const tags: Tag[] = (saveTags || [])
        .filter((st) => st.tags && typeof st.tags === "object" && !Array.isArray(st.tags))
        .map((st) => {
          const tag = st.tags as unknown as Record<string, unknown>;
          return {
            id: tag.id as string,
            spaceId: tag.space_id as string,
            name: tag.name as string,
            createdAt: new Date(tag.created_at as string),
            updatedAt: new Date(tag.updated_at as string),
          };
        });

      const collections: Collection[] = (saveCollections || [])
        .filter(
          (sc) =>
            sc.collections && typeof sc.collections === "object" && !Array.isArray(sc.collections)
        )
        .map((sc) => {
          const col = sc.collections as unknown as Record<string, unknown>;
          return {
            id: col.id as string,
            spaceId: col.space_id as string,
            name: col.name as string,
            visibility: col.visibility as "private" | "public",
            createdAt: new Date(col.created_at as string),
            updatedAt: new Date(col.updated_at as string),
          };
        });

      return transformSave(save, tags, collections);
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
    .mutation(async ({ ctx, input }) => {
      let space = await getUserSpace(ctx.userId);
      if (!space) {
        space = await createSpaceForUser(ctx.userId);
      }

      const { data: save, error } = await supabaseAdmin
        .from("saves")
        .insert({
          space_id: space.id,
          url: input.url,
          title: input.title || null,
          description: input.note || null,
          visibility: input.visibility,
          created_by: ctx.userId,
        })
        .select()
        .single();

      if (error || !save) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create save",
        });
      }

      // Handle tags
      const tags: Tag[] = [];
      if (input.tagNames && input.tagNames.length > 0) {
        for (const tagName of input.tagNames) {
          const normalizedName = tagName.toLowerCase().trim();

          // Get or create tag
          let { data: tag } = await supabaseAdmin
            .from("tags")
            .select("*")
            .eq("space_id", space.id)
            .eq("name", normalizedName)
            .single();

          if (!tag) {
            const { data: newTag } = await supabaseAdmin
              .from("tags")
              .insert({ space_id: space.id, name: normalizedName })
              .select()
              .single();
            tag = newTag;
          }

          if (tag) {
            await supabaseAdmin.from("save_tags").insert({
              save_id: save.id,
              tag_id: tag.id,
            });
            tags.push({
              id: tag.id,
              spaceId: tag.space_id,
              name: tag.name,
              createdAt: new Date(tag.created_at),
              updatedAt: new Date(tag.updated_at),
            });
          }
        }
      }

      // Handle collections
      const collections: Collection[] = [];
      if (input.collectionIds && input.collectionIds.length > 0) {
        for (const collectionId of input.collectionIds) {
          const { data: collection } = await supabaseAdmin
            .from("collections")
            .select("*")
            .eq("id", collectionId)
            .eq("space_id", space.id)
            .single();

          if (collection) {
            await supabaseAdmin.from("save_collections").insert({
              save_id: save.id,
              collection_id: collection.id,
            });
            collections.push({
              id: collection.id,
              spaceId: collection.space_id,
              name: collection.name,
              visibility: collection.visibility,
              createdAt: new Date(collection.created_at),
              updatedAt: new Date(collection.updated_at),
            });
          }
        }
      }

      return transformSave(save, tags, collections);
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
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;

      const { data: save, error } = await supabaseAdmin
        .from("saves")
        .update(updateData)
        .eq("id", input.id)
        .eq("space_id", space.id)
        .select()
        .single();

      if (error || !save) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Save not found" });
      }

      // Update tags if provided
      if (input.tagNames !== undefined) {
        // Remove existing tags
        await supabaseAdmin.from("save_tags").delete().eq("save_id", save.id);

        // Add new tags
        for (const tagName of input.tagNames) {
          const normalizedName = tagName.toLowerCase().trim();

          let { data: tag } = await supabaseAdmin
            .from("tags")
            .select("*")
            .eq("space_id", space.id)
            .eq("name", normalizedName)
            .single();

          if (!tag) {
            const { data: newTag } = await supabaseAdmin
              .from("tags")
              .insert({ space_id: space.id, name: normalizedName })
              .select()
              .single();
            tag = newTag;
          }

          if (tag) {
            await supabaseAdmin.from("save_tags").insert({
              save_id: save.id,
              tag_id: tag.id,
            });
          }
        }
      }

      // Update collections if provided
      if (input.collectionIds !== undefined) {
        // Remove existing collections
        await supabaseAdmin.from("save_collections").delete().eq("save_id", save.id);

        // Add new collections
        for (const collectionId of input.collectionIds) {
          await supabaseAdmin.from("save_collections").insert({
            save_id: save.id,
            collection_id: collectionId,
          });
        }
      }

      // Fetch updated save with relations
      const [{ data: saveTags }, { data: saveCollections }] = await Promise.all([
        supabaseAdmin.from("save_tags").select("tags(*)").eq("save_id", save.id),
        supabaseAdmin.from("save_collections").select("collections(*)").eq("save_id", save.id),
      ]);

      const tags: Tag[] = (saveTags || [])
        .filter((st) => st.tags && typeof st.tags === "object" && !Array.isArray(st.tags))
        .map((st) => {
          const tag = st.tags as unknown as Record<string, unknown>;
          return {
            id: tag.id as string,
            spaceId: tag.space_id as string,
            name: tag.name as string,
            createdAt: new Date(tag.created_at as string),
            updatedAt: new Date(tag.updated_at as string),
          };
        });

      const collections: Collection[] = (saveCollections || [])
        .filter(
          (sc) =>
            sc.collections && typeof sc.collections === "object" && !Array.isArray(sc.collections)
        )
        .map((sc) => {
          const col = sc.collections as unknown as Record<string, unknown>;
          return {
            id: col.id as string,
            spaceId: col.space_id as string,
            name: col.name as string,
            visibility: col.visibility as "private" | "public",
            createdAt: new Date(col.created_at as string),
            updatedAt: new Date(col.updated_at as string),
          };
        });

      return transformSave(save, tags, collections);
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ saveId: z.string(), value: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      // Get current value if not provided
      const { data: current } = await supabaseAdmin
        .from("saves")
        .select("is_favorite")
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .single();

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Save not found" });
      }

      const newValue = input.value ?? !current.is_favorite;

      const { data: save, error } = await supabaseAdmin
        .from("saves")
        .update({ is_favorite: newValue })
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .select()
        .single();

      if (error || !save) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update" });
      }

      return transformSave(save);
    }),

  toggleArchive: protectedProcedure
    .input(z.object({ saveId: z.string(), value: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      // Get current value if not provided
      const { data: current } = await supabaseAdmin
        .from("saves")
        .select("is_archived")
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .single();

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Save not found" });
      }

      const newValue = input.value ?? !current.is_archived;

      const { data: save, error } = await supabaseAdmin
        .from("saves")
        .update({ is_archived: newValue })
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .select()
        .single();

      if (error || !save) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update" });
      }

      return transformSave(save);
    }),

  deleteSave: protectedProcedure
    .input(z.object({ saveId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const { error } = await supabaseAdmin
        .from("saves")
        .delete()
        .eq("id", input.saveId)
        .eq("space_id", space.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete" });
      }

      return { success: true, id: input.saveId };
    }),

  // Collections
  listCollections: protectedProcedure.query(async ({ ctx }) => {
    const space = await getUserSpace(ctx.userId);
    if (!space) return [];

    const { data: collections } = await supabaseAdmin
      .from("collections")
      .select("*, save_collections(count)")
      .eq("space_id", space.id)
      .order("name");

    if (!collections) return [];

    return collections.map((col) => ({
      id: col.id,
      spaceId: col.space_id,
      name: col.name,
      visibility: col.visibility as "private" | "public",
      createdAt: new Date(col.created_at),
      updatedAt: new Date(col.updated_at),
      _count: {
        saves: Array.isArray(col.save_collections) ? col.save_collections.length : 0,
      },
    }));
  }),

  createCollection: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        visibility: z.enum(["private", "public"]).default("private"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let space = await getUserSpace(ctx.userId);
      if (!space) {
        space = await createSpaceForUser(ctx.userId);
      }

      const { data: collection, error } = await supabaseAdmin
        .from("collections")
        .insert({
          space_id: space.id,
          name: input.name,
          visibility: input.visibility,
        })
        .select()
        .single();

      if (error || !collection) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create collection",
        });
      }

      return {
        id: collection.id,
        spaceId: collection.space_id,
        name: collection.name,
        visibility: collection.visibility as "private" | "public",
        createdAt: new Date(collection.created_at),
        updatedAt: new Date(collection.updated_at),
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
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;

      const { data: collection, error } = await supabaseAdmin
        .from("collections")
        .update(updateData)
        .eq("id", input.id)
        .eq("space_id", space.id)
        .select()
        .single();

      if (error || !collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }

      return {
        id: collection.id,
        spaceId: collection.space_id,
        name: collection.name,
        visibility: collection.visibility as "private" | "public",
        createdAt: new Date(collection.created_at),
        updatedAt: new Date(collection.updated_at),
      };
    }),

  deleteCollection: protectedProcedure
    .input(z.object({ collectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const { error } = await supabaseAdmin
        .from("collections")
        .delete()
        .eq("id", input.collectionId)
        .eq("space_id", space.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete" });
      }

      return { success: true, id: input.collectionId };
    }),

  // Tags
  listTags: protectedProcedure.query(async ({ ctx }) => {
    const space = await getUserSpace(ctx.userId);
    if (!space) return [];

    const { data: tags } = await supabaseAdmin
      .from("tags")
      .select("*, save_tags(count)")
      .eq("space_id", space.id)
      .order("name");

    if (!tags) return [];

    return tags.map((tag) => ({
      id: tag.id,
      spaceId: tag.space_id,
      name: tag.name,
      createdAt: new Date(tag.created_at),
      updatedAt: new Date(tag.updated_at),
      _count: {
        saves: Array.isArray(tag.save_tags) ? tag.save_tags.length : 0,
      },
    }));
  }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      let space = await getUserSpace(ctx.userId);
      if (!space) {
        space = await createSpaceForUser(ctx.userId);
      }

      const normalizedName = input.name.toLowerCase().trim();

      const { data: tag, error } = await supabaseAdmin
        .from("tags")
        .insert({
          space_id: space.id,
          name: normalizedName,
        })
        .select()
        .single();

      if (error || !tag) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create tag",
        });
      }

      return {
        id: tag.id,
        spaceId: tag.space_id,
        name: tag.name,
        createdAt: new Date(tag.created_at),
        updatedAt: new Date(tag.updated_at),
        _count: { saves: 0 },
      };
    }),

  updateTag: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const normalizedName = input.name.toLowerCase().trim();

      const { data: tag, error } = await supabaseAdmin
        .from("tags")
        .update({ name: normalizedName })
        .eq("id", input.id)
        .eq("space_id", space.id)
        .select()
        .single();

      if (error || !tag) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found" });
      }

      return {
        id: tag.id,
        spaceId: tag.space_id,
        name: tag.name,
        createdAt: new Date(tag.created_at),
        updatedAt: new Date(tag.updated_at),
      };
    }),

  deleteTag: protectedProcedure
    .input(z.object({ tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const { error } = await supabaseAdmin
        .from("tags")
        .delete()
        .eq("id", input.tagId)
        .eq("space_id", space.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete" });
      }

      return { success: true, id: input.tagId };
    }),

  // Stats
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const space = await getUserSpace(ctx.userId);
    if (!space) {
      return {
        totalSaves: 0,
        publicSaves: 0,
        privateSaves: 0,
        favorites: 0,
        archived: 0,
        collections: 0,
        tags: 0,
        visitCount: 0,
      };
    }

    const [
      { count: totalSaves },
      { count: publicSaves },
      { count: privateSaves },
      { count: favorites },
      { count: archived },
      { count: collections },
      { count: tags },
    ] = await Promise.all([
      supabaseAdmin
        .from("saves")
        .select("*", { count: "exact", head: true })
        .eq("space_id", space.id),
      supabaseAdmin
        .from("saves")
        .select("*", { count: "exact", head: true })
        .eq("space_id", space.id)
        .eq("visibility", "public"),
      supabaseAdmin
        .from("saves")
        .select("*", { count: "exact", head: true })
        .eq("space_id", space.id)
        .eq("visibility", "private"),
      supabaseAdmin
        .from("saves")
        .select("*", { count: "exact", head: true })
        .eq("space_id", space.id)
        .eq("is_favorite", true),
      supabaseAdmin
        .from("saves")
        .select("*", { count: "exact", head: true })
        .eq("space_id", space.id)
        .eq("is_archived", true),
      supabaseAdmin
        .from("collections")
        .select("*", { count: "exact", head: true })
        .eq("space_id", space.id),
      supabaseAdmin
        .from("tags")
        .select("*", { count: "exact", head: true })
        .eq("space_id", space.id),
    ]);

    const visitCount = await getVisitCount(space.id);

    return {
      totalSaves: totalSaves || 0,
      publicSaves: publicSaves || 0,
      privateSaves: privateSaves || 0,
      favorites: favorites || 0,
      archived: archived || 0,
      collections: collections || 0,
      tags: tags || 0,
      visitCount,
    };
  }),

  // Combined dashboard data - fetches everything in one call
  getDashboardData: protectedProcedure.query(async ({ ctx }) => {
    let space = await getUserSpace(ctx.userId);

    // Create space if user doesn't have one
    if (!space) {
      space = await createSpaceForUser(ctx.userId);
    }

    // Fetch stats and recent saves in parallel
    const [statsResult, savesResult] = await Promise.all([
      // Stats queries
      Promise.all([
        supabaseAdmin
          .from("saves")
          .select("*", { count: "exact", head: true })
          .eq("space_id", space.id),
        supabaseAdmin
          .from("saves")
          .select("*", { count: "exact", head: true })
          .eq("space_id", space.id)
          .eq("visibility", "public"),
        supabaseAdmin
          .from("saves")
          .select("*", { count: "exact", head: true })
          .eq("space_id", space.id)
          .eq("is_favorite", true),
        supabaseAdmin
          .from("collections")
          .select("*", { count: "exact", head: true })
          .eq("space_id", space.id),
        supabaseAdmin
          .from("tags")
          .select("*", { count: "exact", head: true })
          .eq("space_id", space.id),
        getVisitCount(space.id),
      ]),
      // Recent saves query
      supabaseAdmin
        .from("saves")
        .select("*")
        .eq("space_id", space.id)
        .order("saved_at", { ascending: false })
        .limit(5),
    ]);

    const [
      { count: totalSaves },
      { count: publicSaves },
      { count: favorites },
      { count: collections },
      { count: tags },
      visitCount,
    ] = statsResult;

    const { data: saves } = savesResult;

    const recentSaves: Save[] = (saves || []).map((save) => ({
      id: save.id,
      spaceId: save.space_id,
      url: save.url,
      title: save.title,
      description: save.description,
      siteName: save.site_name,
      imageUrl: save.image_url,
      favicon: save.favicon,
      visibility: save.visibility,
      isArchived: save.is_archived,
      isFavorite: save.is_favorite,
      savedAt: new Date(save.saved_at),
      createdBy: save.created_by,
      tags: [],
      collections: [],
    }));

    return {
      space,
      stats: {
        totalSaves: totalSaves || 0,
        publicSaves: publicSaves || 0,
        favorites: favorites || 0,
        collections: collections || 0,
        tags: tags || 0,
        visitCount,
      },
      recentSaves,
    };
  }),
});

// Main app router
export const appRouter = router({
  public: publicRouter,
  space: spaceRouter,
});

export type AppRouter = typeof appRouter;
