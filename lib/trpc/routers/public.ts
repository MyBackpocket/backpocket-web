import { z } from "zod/v4";
import {
  extractCustomDomain,
  isCustomDomainSlug,
  PUBLIC_LIST_DEFAULT_LIMIT,
  PUBLIC_LIST_MAX_LIMIT,
  PUBLIC_LIST_MIN_LIMIT,
} from "@/lib/constants/public-space";
import { SNAPSHOT_STORAGE_BUCKET, SNAPSHOTS_ENABLED } from "@/lib/constants/snapshots";
import { getVisitCount, incrementVisitCount } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  PublicSave,
  SnapshotBlockedReason,
  SnapshotContent,
  SnapshotStatus,
} from "@/lib/types";
import { resolveSpaceFromHost } from "../services/public-space";
import { publicProcedure, router } from "../trpc";

export const publicRouter = router({
  resolveSpaceByHost: publicProcedure
    .input(z.object({ host: z.string() }))
    .query(async ({ input }) => {
      return resolveSpaceFromHost(input.host);
    }),

  // Resolve space by slug directly (for when we already have the slug from middleware)
  resolveSpaceBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      // Handle custom domain marker from middleware
      if (isCustomDomainSlug(input.slug)) {
        const customDomain = extractCustomDomain(input.slug);
        return resolveSpaceFromHost(customDomain);
      }

      // Regular slug lookup
      const { data: space } = await supabaseAdmin
        .from("spaces")
        .select("*")
        .eq("slug", input.slug)
        .eq("visibility", "public")
        .single();

      if (!space) return null;

      const visitCount = await getVisitCount(space.id);

      return {
        id: space.id,
        slug: space.slug,
        name: space.name,
        bio: space.bio,
        avatarUrl: space.avatar_url,
        publicLayout: space.public_layout as "list" | "grid",
        visitCount,
      };
    }),

  listPublicSaves: publicProcedure
    .input(
      z.object({
        spaceId: z.string(),
        query: z.string().optional(),
        tagName: z.string().optional(),
        collectionId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z
          .number()
          .min(PUBLIC_LIST_MIN_LIMIT)
          .max(PUBLIC_LIST_MAX_LIMIT)
          .default(PUBLIC_LIST_DEFAULT_LIMIT),
      })
    )
    .query(async ({ input }) => {
      // For tag/collection filtering, first get the filtered save IDs
      let filteredSaveIds: string[] | null = null;

      if (input.tagName) {
        // Get save IDs that have the specified tag
        const { data: taggedSaves } = await supabaseAdmin
          .from("save_tags")
          .select("save_id, tags!inner(name)")
          .eq("tags.name", input.tagName.toLowerCase());

        if (!taggedSaves || taggedSaves.length === 0) {
          return { items: [], nextCursor: null };
        }
        filteredSaveIds = taggedSaves.map((ts) => ts.save_id);
      } else if (input.collectionId) {
        // Get save IDs in the specified collection
        const { data: collectionSaves } = await supabaseAdmin
          .from("save_collections")
          .select("save_id")
          .eq("collection_id", input.collectionId);

        if (!collectionSaves || collectionSaves.length === 0) {
          return { items: [], nextCursor: null };
        }
        filteredSaveIds = collectionSaves.map((cs) => cs.save_id);
      }

      // Build the main query
      let query = supabaseAdmin
        .from("saves")
        .select("*")
        .eq("space_id", input.spaceId)
        .eq("visibility", "public")
        .eq("is_archived", false)
        .order("saved_at", { ascending: false })
        .limit(input.limit + 1);

      // Apply tag/collection filter
      if (filteredSaveIds) {
        query = query.in("id", filteredSaveIds);
      }

      // Apply search query
      if (input.query) {
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

      // Get tags for all saves
      const saveIds = saves.slice(0, input.limit).map((s) => s.id);
      const { data: saveTags } = await supabaseAdmin
        .from("save_tags")
        .select("save_id, tags(id, name)")
        .in("save_id", saveIds);

      const tagsBySaveId = new Map<string, string[]>();
      for (const st of saveTags || []) {
        const tags = tagsBySaveId.get(st.save_id) || [];
        if (st.tags && typeof st.tags === "object" && "name" in st.tags) {
          tags.push((st.tags as { name: string }).name);
        }
        tagsBySaveId.set(st.save_id, tags);
      }

      const items: PublicSave[] = saves.slice(0, input.limit).map((save) => ({
        id: save.id,
        url: save.url,
        title: save.title,
        description: save.description,
        siteName: save.site_name,
        imageUrl: save.image_url,
        savedAt: new Date(save.saved_at),
        tags: tagsBySaveId.get(save.id),
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
        .eq("visibility", "public")
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

  /**
   * List tags that have at least one public save in the space
   */
  listPublicTags: publicProcedure
    .input(z.object({ spaceId: z.string() }))
    .query(async ({ input }) => {
      // First get public, non-archived save IDs for this space
      const { data: publicSaves } = await supabaseAdmin
        .from("saves")
        .select("id")
        .eq("space_id", input.spaceId)
        .eq("visibility", "public")
        .eq("is_archived", false);

      if (!publicSaves || publicSaves.length === 0) {
        return [];
      }

      const publicSaveIds = publicSaves.map((s) => s.id);

      // Get tags for these saves
      const { data: saveTags } = await supabaseAdmin
        .from("save_tags")
        .select("tags(id, name)")
        .in("save_id", publicSaveIds);

      if (!saveTags || saveTags.length === 0) {
        return [];
      }

      // Aggregate counts by tag
      const countMap = new Map<string, { name: string; count: number }>();
      for (const row of saveTags) {
        if (row.tags && typeof row.tags === "object" && "name" in row.tags) {
          const tag = row.tags as unknown as { id: string; name: string };
          const existing = countMap.get(tag.name);
          if (existing) {
            existing.count++;
          } else {
            countMap.set(tag.name, { name: tag.name, count: 1 });
          }
        }
      }

      // Sort by count descending, then alphabetically
      return Array.from(countMap.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    }),

  /**
   * List collections containing at least one public save
   */
  listPublicCollections: publicProcedure
    .input(z.object({ spaceId: z.string() }))
    .query(async ({ input }) => {
      // First get public, non-archived save IDs for this space
      const { data: publicSaves } = await supabaseAdmin
        .from("saves")
        .select("id")
        .eq("space_id", input.spaceId)
        .eq("visibility", "public")
        .eq("is_archived", false);

      if (!publicSaves || publicSaves.length === 0) {
        return [];
      }

      const publicSaveIds = publicSaves.map((s) => s.id);

      // Get collections for these saves
      const { data: saveCollections } = await supabaseAdmin
        .from("save_collections")
        .select("collections(id, name)")
        .in("save_id", publicSaveIds);

      if (!saveCollections || saveCollections.length === 0) {
        return [];
      }

      // Aggregate counts by collection
      const countMap = new Map<string, { id: string; name: string; count: number }>();
      for (const row of saveCollections) {
        if (row.collections && typeof row.collections === "object" && "id" in row.collections) {
          const col = row.collections as unknown as { id: string; name: string };
          const existing = countMap.get(col.id);
          if (existing) {
            existing.count++;
          } else {
            countMap.set(col.id, { id: col.id, name: col.name, count: 1 });
          }
        }
      }

      // Sort by count descending, then alphabetically
      return Array.from(countMap.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    }),

  registerVisit: publicProcedure
    .input(z.object({ spaceId: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      const newTotal = await incrementVisitCount(input.spaceId);
      return { ok: true, visitCount: newTotal };
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

  /**
   * Get snapshot for a public save
   */
  getPublicSaveSnapshot: publicProcedure
    .input(
      z.object({
        spaceId: z.string().uuid(),
        saveId: z.string().uuid(),
        includeContent: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      if (!SNAPSHOTS_ENABLED) {
        return null;
      }

      // Verify the save is public
      const { data: save } = await supabaseAdmin
        .from("saves")
        .select("id, visibility")
        .eq("id", input.saveId)
        .eq("space_id", input.spaceId)
        .eq("visibility", "public")
        .single();

      if (!save) {
        return null;
      }

      // Get the snapshot record
      const { data: snapshot } = await supabaseAdmin
        .from("save_snapshots")
        .select("*")
        .eq("save_id", input.saveId)
        .single();

      if (!snapshot) {
        return null;
      }

      const result: {
        snapshot: {
          status: SnapshotStatus;
          blockedReason: SnapshotBlockedReason | null;
          fetchedAt: Date | null;
          title: string | null;
          byline: string | null;
          excerpt: string | null;
          wordCount: number | null;
          language: string | null;
        };
        content?: SnapshotContent;
      } = {
        snapshot: {
          status: snapshot.status as SnapshotStatus,
          blockedReason: snapshot.blocked_reason as SnapshotBlockedReason | null,
          fetchedAt: snapshot.fetched_at ? new Date(snapshot.fetched_at) : null,
          title: snapshot.title,
          byline: snapshot.byline,
          excerpt: snapshot.excerpt,
          wordCount: snapshot.word_count,
          language: snapshot.language,
        },
      };

      // If content requested and snapshot is ready, fetch from storage
      if (input.includeContent && snapshot.status === "ready" && snapshot.storage_path) {
        try {
          const { data, error } = await supabaseAdmin.storage
            .from(SNAPSHOT_STORAGE_BUCKET)
            .download(snapshot.storage_path);

          if (!error && data) {
            // Dynamic import to avoid loading node:crypto/node:zlib at module init
            const { deserializeSnapshot } = await import("@/lib/snapshots");
            const buffer = Buffer.from(await data.arrayBuffer());
            result.content = deserializeSnapshot(buffer);
          }
        } catch (err) {
          console.error("[public-snapshots] Failed to download content:", err);
        }
      }

      return result;
    }),
});
