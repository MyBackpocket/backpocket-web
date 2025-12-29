import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { SNAPSHOTS_ENABLED } from "@/lib/constants/snapshots";
import { enqueueSnapshotJob } from "@/lib/snapshots/queue";
import { supabaseAdmin } from "@/lib/supabase";
import type { Collection, Tag } from "@/lib/types";
import { createSpaceForUser, getUserSpace } from "../../services/space";
import { transformSave } from "../../services/transforms";
import { protectedProcedure, router } from "../../trpc";

export const savesRouter = router({
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      let space = await getUserSpace(ctx.userId, ctx.spaceCache);
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

      // Create snapshot job if snapshots are enabled
      if (SNAPSHOTS_ENABLED) {
        // Create the snapshot record
        await supabaseAdmin.from("save_snapshots").insert({
          save_id: save.id,
          space_id: space.id,
          status: "pending",
        });

        // Enqueue the snapshot job (fire and forget - don't block save creation)
        enqueueSnapshotJob(save.id, space.id, input.url).catch((err) => {
          console.error("[saves] Failed to enqueue snapshot job:", err);
        });
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
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
});
