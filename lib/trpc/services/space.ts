import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Space } from "@/lib/types";
import type { SpaceCache } from "../context";

// Debug logging for cache hits (only in development)
const DEBUG_CACHE = process.env.NODE_ENV === "development";

/**
 * Get user's space with request-scoped caching.
 * The cache is stored in the tRPC context to ensure it's per-request.
 */
export async function getUserSpace(userId: string, spaceCache: SpaceCache): Promise<Space | null> {
  // Check cache first
  const cached = spaceCache.get(userId);
  if (cached) {
    if (DEBUG_CACHE) console.log(`[spaceCache] ✅ HIT for user ${userId.slice(0, 8)}...`);
    return cached;
  }

  if (DEBUG_CACHE)
    console.log(`[spaceCache] ❌ MISS for user ${userId.slice(0, 8)}... fetching from DB`);

  // Create the promise and cache it immediately (before awaiting)
  const promise = fetchUserSpaceFromDB(userId);
  spaceCache.set(userId, promise);

  return promise;
}

/**
 * Fetch user's space from database.
 * Uses a single query with join for efficiency.
 */
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
    if (DEBUG_CACHE)
      console.log(
        `[spaceCache] DB query took ${(performance.now() - start).toFixed(1)}ms (no space found)`
      );
    return null;
  }

  const space = membership.spaces as unknown as {
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

  if (DEBUG_CACHE)
    console.log(`[spaceCache] DB query took ${(performance.now() - start).toFixed(1)}ms`);

  return {
    id: space.id,
    type: space.type as "personal" | "org",
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

/**
 * Create a space for a new user.
 */
export async function createSpaceForUser(userId: string): Promise<Space> {
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
