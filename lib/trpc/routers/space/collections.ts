import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { supabaseAdmin } from "@/lib/supabase";
import type { Tag } from "@/lib/types";
import { createSpaceForUser, getUserSpace } from "../../services/space";
import { protectedProcedure, router } from "../../trpc";

// Type for collection list items returned by listCollections
type CollectionListItem = {
  id: string;
  spaceId: string;
  name: string;
  visibility: "private" | "public";
  createdAt: Date;
  updatedAt: Date;
  defaultTags: Tag[];
  _count: { saves: number };
};

export const collectionsRouter = router({
  listCollections: protectedProcedure.query(async ({ ctx }): Promise<CollectionListItem[]> => {
    const space = await getUserSpace(ctx.userId, ctx.spaceCache);
    if (!space) return [];

    const { data: collections } = await supabaseAdmin
      .from("collections")
      .select("*, save_collections(count)")
      .eq("space_id", space.id)
      .order("name");

    if (!collections) return [];

    // Fetch default tags for all collections in one query
    const collectionIds = collections.map((c) => c.id);
    const { data: defaultTagLinks } = await supabaseAdmin
      .from("collection_default_tags")
      .select("collection_id, tags(id, space_id, name, created_at, updated_at)")
      .in("collection_id", collectionIds);

    // Group default tags by collection
    const defaultTagsByCollection = new Map<string, Tag[]>();
    for (const link of defaultTagLinks || []) {
      const tags = defaultTagsByCollection.get(link.collection_id) || [];
      if (link.tags && typeof link.tags === "object" && !Array.isArray(link.tags)) {
        const tag = link.tags as unknown as Record<string, unknown>;
        tags.push({
          id: tag.id as string,
          spaceId: tag.space_id as string,
          name: tag.name as string,
          createdAt: new Date(tag.created_at as string),
          updatedAt: new Date(tag.updated_at as string),
        });
      }
      defaultTagsByCollection.set(link.collection_id, tags);
    }

    return collections.map((col) => ({
      id: col.id,
      spaceId: col.space_id,
      name: col.name,
      visibility: col.visibility as "private" | "public",
      createdAt: new Date(col.created_at),
      updatedAt: new Date(col.updated_at),
      defaultTags: defaultTagsByCollection.get(col.id) || [],
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
        defaultTagNames: z.array(z.string()).optional(),
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

      // Handle default tags
      const defaultTags: Tag[] = [];
      if (input.defaultTagNames && input.defaultTagNames.length > 0) {
        const normalizedNames = [
          ...new Set(input.defaultTagNames.map((n) => n.toLowerCase().trim())),
        ];

        // Upsert tags (create if not exists)
        const { data: upsertedTags } = await supabaseAdmin
          .from("tags")
          .upsert(
            normalizedNames.map((name) => ({ space_id: space.id, name })),
            { onConflict: "space_id,name", ignoreDuplicates: false }
          )
          .select();

        let finalTags = upsertedTags;
        if (!finalTags || finalTags.length === 0) {
          const { data: existingTags } = await supabaseAdmin
            .from("tags")
            .select("*")
            .eq("space_id", space.id)
            .in("name", normalizedNames);
          finalTags = existingTags;
        }

        if (finalTags && finalTags.length > 0) {
          // Link tags as defaults for this collection
          await supabaseAdmin
            .from("collection_default_tags")
            .insert(finalTags.map((tag) => ({ collection_id: collection.id, tag_id: tag.id })));

          for (const tag of finalTags) {
            defaultTags.push({
              id: tag.id,
              spaceId: tag.space_id,
              name: tag.name,
              createdAt: new Date(tag.created_at),
              updatedAt: new Date(tag.updated_at),
            });
          }
        }
      }

      return {
        id: collection.id,
        spaceId: collection.space_id,
        name: collection.name,
        visibility: collection.visibility as "private" | "public",
        createdAt: new Date(collection.created_at),
        updatedAt: new Date(collection.updated_at),
        defaultTags,
        _count: { saves: 0 },
      };
    }),

  updateCollection: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        visibility: z.enum(["private", "public"]).optional(),
        defaultTagNames: z.array(z.string()).optional(),
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

      // Only update if there's data to update (name/visibility)
      let collection: {
        id: string;
        space_id: string;
        name: string;
        visibility: string;
        created_at: string;
        updated_at: string;
      };
      if (Object.keys(updateData).length > 0) {
        const { data, error } = await supabaseAdmin
          .from("collections")
          .update(updateData)
          .eq("id", input.id)
          .eq("space_id", space.id)
          .select()
          .single();

        if (error || !data) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
        }
        collection = data;
      } else {
        // Just fetch the collection if no base updates
        const { data, error } = await supabaseAdmin
          .from("collections")
          .select()
          .eq("id", input.id)
          .eq("space_id", space.id)
          .single();

        if (error || !data) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
        }
        collection = data;
      }

      // Handle default tags update
      let defaultTags: Tag[] = [];
      if (input.defaultTagNames !== undefined) {
        // Remove existing default tags
        await supabaseAdmin.from("collection_default_tags").delete().eq("collection_id", input.id);

        if (input.defaultTagNames.length > 0) {
          const normalizedNames = [
            ...new Set(input.defaultTagNames.map((n) => n.toLowerCase().trim())),
          ];

          // Upsert tags
          const { data: upsertedTags } = await supabaseAdmin
            .from("tags")
            .upsert(
              normalizedNames.map((name) => ({ space_id: space.id, name })),
              { onConflict: "space_id,name", ignoreDuplicates: false }
            )
            .select();

          let finalTags = upsertedTags;
          if (!finalTags || finalTags.length === 0) {
            const { data: existingTags } = await supabaseAdmin
              .from("tags")
              .select("*")
              .eq("space_id", space.id)
              .in("name", normalizedNames);
            finalTags = existingTags;
          }

          if (finalTags && finalTags.length > 0) {
            await supabaseAdmin
              .from("collection_default_tags")
              .insert(finalTags.map((tag) => ({ collection_id: input.id, tag_id: tag.id })));

            defaultTags = finalTags.map((tag) => ({
              id: tag.id,
              spaceId: tag.space_id,
              name: tag.name,
              createdAt: new Date(tag.created_at),
              updatedAt: new Date(tag.updated_at),
            }));
          }
        }
      } else {
        // Fetch existing default tags if not updating them
        const { data: defaultTagLinks } = await supabaseAdmin
          .from("collection_default_tags")
          .select("tags(id, space_id, name, created_at, updated_at)")
          .eq("collection_id", input.id);

        defaultTags = (defaultTagLinks || [])
          .filter((link) => link.tags && typeof link.tags === "object" && !Array.isArray(link.tags))
          .map((link) => {
            const tag = link.tags as unknown as Record<string, unknown>;
            return {
              id: tag.id as string,
              spaceId: tag.space_id as string,
              name: tag.name as string,
              createdAt: new Date(tag.created_at as string),
              updatedAt: new Date(tag.updated_at as string),
            };
          });
      }

      return {
        id: collection.id,
        spaceId: collection.space_id,
        name: collection.name,
        visibility: collection.visibility as "private" | "public",
        createdAt: new Date(collection.created_at),
        updatedAt: new Date(collection.updated_at),
        defaultTags,
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
