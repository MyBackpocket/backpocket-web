import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { supabaseAdmin } from "@/lib/supabase";
import { createSpaceForUser, getUserSpace } from "../../services/space";
import { protectedProcedure, router } from "../../trpc";

export const collectionsRouter = router({
  listCollections: protectedProcedure.query(async ({ ctx }) => {
    const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      let space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
});
