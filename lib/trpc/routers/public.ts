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
        cursor: z.string().optional(),
        limit: z
          .number()
          .min(PUBLIC_LIST_MIN_LIMIT)
          .max(PUBLIC_LIST_MAX_LIMIT)
          .default(PUBLIC_LIST_DEFAULT_LIMIT),
      })
    )
    .query(async ({ input }) => {
      let query = supabaseAdmin
        .from("saves")
        .select("*")
        .eq("space_id", input.spaceId)
        .eq("visibility", "public")
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
