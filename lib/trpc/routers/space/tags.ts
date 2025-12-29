import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { supabaseAdmin } from "@/lib/supabase";
import { createSpaceForUser, getUserSpace } from "../../services/space";
import { protectedProcedure, router } from "../../trpc";

export const tagsRouter = router({
  listTags: protectedProcedure.query(async ({ ctx }) => {
    const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      let space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
});
