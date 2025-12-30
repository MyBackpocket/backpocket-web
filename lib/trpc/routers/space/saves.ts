import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { SNAPSHOTS_ENABLED } from "@/lib/constants/snapshots";
import { enqueueSnapshotJob } from "@/lib/snapshots/queue";
import { supabaseAdmin } from "@/lib/supabase";
import type { Collection, Tag } from "@/lib/types";
import { createSpaceForUser, getUserSpace } from "../../services/space";
import { transformSave } from "../../services/transforms";
import { protectedProcedure, router } from "../../trpc";

// Columns needed for list view (avoid select(*) to reduce payload)
const SAVE_LIST_COLUMNS = `
  id,
  url,
  title,
  description,
  site_name,
  image_url,
  visibility,
  is_archived,
  is_favorite,
  saved_at
`;

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

      // For tag/collection filters, use inner join via Supabase's relation syntax
      // This is more efficient than fetching IDs then using IN(...)
      let selectClause = SAVE_LIST_COLUMNS;

      // Build the base query with optional joins for filtering
      if (input.tagId) {
        // Use inner join on save_tags to filter
        selectClause = `${SAVE_LIST_COLUMNS}, save_tags!inner(tag_id)`;
      } else if (input.collectionId) {
        // Use inner join on save_collections to filter
        selectClause = `${SAVE_LIST_COLUMNS}, save_collections!inner(collection_id)`;
      }

      let query = supabaseAdmin
        .from("saves")
        .select(selectClause)
        .eq("space_id", space.id)
        .order("saved_at", { ascending: false })
        .limit(input.limit + 1);

      // Apply tag filter via the joined table
      if (input.tagId) {
        query = query.eq("save_tags.tag_id", input.tagId);
      }

      // Apply collection filter via the joined table
      if (input.collectionId) {
        query = query.eq("save_collections.collection_id", input.collectionId);
      }

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
        // Escape special characters in search to prevent injection
        const escapedQuery = input.query.replace(/[%_]/g, "\\$&");
        query = query.or(
          `title.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%,url.ilike.%${escapedQuery}%`
        );
      }
      if (input.cursor) {
        query = query.lt("saved_at", input.cursor);
      }

      const { data: saves } = await query;

      if (!saves || saves.length === 0) {
        return { items: [], nextCursor: null };
      }

      // Type assertion for dynamic select clause results
      type SaveRecord = { id: string; saved_at: string; [key: string]: unknown };
      const typedSaves = saves as unknown as SaveRecord[];

      // Get tags and collections for all saves in parallel (single query each)
      const saveIds = typedSaves.slice(0, input.limit).map((s) => s.id);

      const [{ data: saveTags }, { data: saveCollections }] = await Promise.all([
        supabaseAdmin
          .from("save_tags")
          .select("save_id, tags(id, space_id, name, created_at, updated_at)")
          .in("save_id", saveIds),
        supabaseAdmin
          .from("save_collections")
          .select("save_id, collections(id, space_id, name, visibility, created_at, updated_at)")
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

      const items = typedSaves
        .slice(0, input.limit)
        .map((save) =>
          transformSave(
            save,
            tagsBySaveId.get(save.id) || [],
            collectionsBySaveId.get(save.id) || []
          )
        );

      const hasMore = typedSaves.length > input.limit;
      const nextCursor = hasMore ? typedSaves[input.limit - 1].saved_at : null;

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

      // Handle tags - batch operations to reduce roundtrips
      const tags: Tag[] = [];
      if (input.tagNames && input.tagNames.length > 0) {
        const normalizedNames = [...new Set(input.tagNames.map((n) => n.toLowerCase().trim()))];

        // Batch upsert all tags at once (uses ON CONFLICT from UNIQUE(space_id, name))
        const { data: upsertedTags } = await supabaseAdmin
          .from("tags")
          .upsert(
            normalizedNames.map((name) => ({ space_id: space.id, name })),
            { onConflict: "space_id,name", ignoreDuplicates: false }
          )
          .select();

        // If upsert didn't return data (some DBs don't), fetch the tags
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
          // Batch insert all save_tags at once
          await supabaseAdmin
            .from("save_tags")
            .insert(finalTags.map((tag) => ({ save_id: save.id, tag_id: tag.id })));

          for (const tag of finalTags) {
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

      // Handle collections - batch validation and insert
      const collections: Collection[] = [];
      if (input.collectionIds && input.collectionIds.length > 0) {
        // Validate all collections belong to space in single query
        const { data: validCollections } = await supabaseAdmin
          .from("collections")
          .select("*")
          .eq("space_id", space.id)
          .in("id", input.collectionIds);

        if (validCollections && validCollections.length > 0) {
          // Batch insert all save_collections at once
          await supabaseAdmin
            .from("save_collections")
            .insert(validCollections.map((col) => ({ save_id: save.id, collection_id: col.id })));

          for (const col of validCollections) {
            collections.push({
              id: col.id,
              spaceId: col.space_id,
              name: col.name,
              visibility: col.visibility,
              createdAt: new Date(col.created_at),
              updatedAt: new Date(col.updated_at),
            });
          }
        }
      }

      // Create snapshot job if snapshots are enabled (fire and forget)
      if (SNAPSHOTS_ENABLED) {
        // Create the snapshot record and enqueue job (async, don't block response)
        (async () => {
          try {
            const { error } = await supabaseAdmin.from("save_snapshots").insert({
              save_id: save.id,
              space_id: space.id,
              status: "pending",
            });
            if (error) {
              console.error("[saves] Snapshot record error:", error);
              return;
            }
            // Enqueue the snapshot job after record is created
            await enqueueSnapshotJob(save.id, space.id, input.url);
          } catch (err) {
            console.error("[saves] Snapshot error:", err);
          }
        })();
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

      // Update tags if provided - batch operations
      let tags: Tag[] = [];
      if (input.tagNames !== undefined) {
        // Remove existing tags first
        await supabaseAdmin.from("save_tags").delete().eq("save_id", save.id);

        if (input.tagNames.length > 0) {
          const normalizedNames = [...new Set(input.tagNames.map((n) => n.toLowerCase().trim()))];

          // Batch upsert all tags
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
            // Batch insert all save_tags
            await supabaseAdmin
              .from("save_tags")
              .insert(finalTags.map((tag) => ({ save_id: save.id, tag_id: tag.id })));

            tags = finalTags.map((tag) => ({
              id: tag.id,
              spaceId: tag.space_id,
              name: tag.name,
              createdAt: new Date(tag.created_at),
              updatedAt: new Date(tag.updated_at),
            }));
          }
        }
      }

      // Update collections if provided - batch operations
      let collections: Collection[] = [];
      if (input.collectionIds !== undefined) {
        // Remove existing collections first
        await supabaseAdmin.from("save_collections").delete().eq("save_id", save.id);

        if (input.collectionIds.length > 0) {
          // Validate all collections belong to space
          const { data: validCollections } = await supabaseAdmin
            .from("collections")
            .select("*")
            .eq("space_id", space.id)
            .in("id", input.collectionIds);

          if (validCollections && validCollections.length > 0) {
            // Batch insert all save_collections
            await supabaseAdmin
              .from("save_collections")
              .insert(validCollections.map((col) => ({ save_id: save.id, collection_id: col.id })));

            collections = validCollections.map((col) => ({
              id: col.id,
              spaceId: col.space_id,
              name: col.name,
              visibility: col.visibility as "private" | "public",
              createdAt: new Date(col.created_at),
              updatedAt: new Date(col.updated_at),
            }));
          }
        }
      }

      // If tags/collections weren't updated, fetch current ones
      if (input.tagNames === undefined || input.collectionIds === undefined) {
        const [{ data: saveTags }, { data: saveCollections }] = await Promise.all([
          input.tagNames === undefined
            ? supabaseAdmin
                .from("save_tags")
                .select("tags(id, space_id, name, created_at, updated_at)")
                .eq("save_id", save.id)
            : Promise.resolve({ data: null }),
          input.collectionIds === undefined
            ? supabaseAdmin
                .from("save_collections")
                .select("collections(id, space_id, name, visibility, created_at, updated_at)")
                .eq("save_id", save.id)
            : Promise.resolve({ data: null }),
        ]);

        if (input.tagNames === undefined && saveTags) {
          tags = saveTags
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
        }

        if (input.collectionIds === undefined && saveCollections) {
          collections = saveCollections
            .filter(
              (sc) =>
                sc.collections &&
                typeof sc.collections === "object" &&
                !Array.isArray(sc.collections)
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
        }
      }

      return transformSave(save, tags, collections);
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ saveId: z.string(), value: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      // If value is explicitly provided, update directly (skip read)
      if (input.value !== undefined) {
        const { data: save, error } = await supabaseAdmin
          .from("saves")
          .update({ is_favorite: input.value })
          .eq("id", input.saveId)
          .eq("space_id", space.id)
          .select(SAVE_LIST_COLUMNS)
          .single();

        if (error || !save) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Save not found" });
        }
        return transformSave(save);
      }

      // Otherwise need to read current value to toggle
      const { data: current } = await supabaseAdmin
        .from("saves")
        .select("is_favorite")
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .single();

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Save not found" });
      }

      const { data: save, error } = await supabaseAdmin
        .from("saves")
        .update({ is_favorite: !current.is_favorite })
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .select(SAVE_LIST_COLUMNS)
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

      // If value is explicitly provided, update directly (skip read)
      if (input.value !== undefined) {
        const { data: save, error } = await supabaseAdmin
          .from("saves")
          .update({ is_archived: input.value })
          .eq("id", input.saveId)
          .eq("space_id", space.id)
          .select(SAVE_LIST_COLUMNS)
          .single();

        if (error || !save) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Save not found" });
        }
        return transformSave(save);
      }

      // Otherwise need to read current value to toggle
      const { data: current } = await supabaseAdmin
        .from("saves")
        .select("is_archived")
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .single();

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Save not found" });
      }

      const { data: save, error } = await supabaseAdmin
        .from("saves")
        .update({ is_archived: !current.is_archived })
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .select(SAVE_LIST_COLUMNS)
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

  bulkDeleteSaves: protectedProcedure
    .input(z.object({ saveIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const { error, count } = await supabaseAdmin
        .from("saves")
        .delete()
        .in("id", input.saveIds)
        .eq("space_id", space.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete saves" });
      }

      return { success: true, deletedCount: count ?? input.saveIds.length };
    }),
});
