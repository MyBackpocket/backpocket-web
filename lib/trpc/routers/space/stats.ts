import { getVisitCount } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";
import type { Save } from "@/lib/types";
import { createSpaceForUser, getUserSpace } from "../../services/space";
import { protectedProcedure, router } from "../../trpc";

export const statsRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
    let space = await getUserSpace(ctx.userId, ctx.spaceCache);

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
      contentType: save.content_type,
      visibility: save.visibility,
      isArchived: save.is_archived,
      isFavorite: save.is_favorite,
      savedAt: new Date(save.saved_at),
      createdAt: new Date(save.created_at),
      updatedAt: new Date(save.updated_at),
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
