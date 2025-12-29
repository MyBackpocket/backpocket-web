/**
 * Snapshot tRPC procedures
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { SNAPSHOT_STORAGE_BUCKET, SNAPSHOTS_ENABLED } from "@/lib/constants/snapshots";
import { deserializeSnapshot } from "@/lib/snapshots";
import {
  checkUserRateLimit,
  enqueueSnapshotJob,
  getUserSnapshotQuota,
} from "@/lib/snapshots/queue";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  SaveSnapshot,
  SnapshotBlockedReason,
  SnapshotContent,
  SnapshotStatus,
} from "@/lib/types";
import { getUserSpace } from "../../services/space";
import { protectedProcedure, router } from "../../trpc";

function transformSnapshot(dbSnapshot: Record<string, unknown>): SaveSnapshot {
  return {
    saveId: dbSnapshot.save_id as string,
    spaceId: dbSnapshot.space_id as string,
    status: dbSnapshot.status as SnapshotStatus,
    blockedReason: dbSnapshot.blocked_reason as SnapshotBlockedReason | null,
    attempts: dbSnapshot.attempts as number,
    nextAttemptAt: dbSnapshot.next_attempt_at
      ? new Date(dbSnapshot.next_attempt_at as string)
      : null,
    fetchedAt: dbSnapshot.fetched_at ? new Date(dbSnapshot.fetched_at as string) : null,
    storagePath: dbSnapshot.storage_path as string | null,
    canonicalUrl: dbSnapshot.canonical_url as string | null,
    title: dbSnapshot.title as string | null,
    byline: dbSnapshot.byline as string | null,
    excerpt: dbSnapshot.excerpt as string | null,
    wordCount: dbSnapshot.word_count as number | null,
    language: dbSnapshot.language as string | null,
    createdAt: new Date(dbSnapshot.created_at as string),
    updatedAt: new Date(dbSnapshot.updated_at as string),
  };
}

export const snapshotsRouter = router({
  /**
   * Get snapshot metadata and optionally content for a save
   */
  getSaveSnapshot: protectedProcedure
    .input(
      z.object({
        saveId: z.string().uuid(),
        includeContent: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!SNAPSHOTS_ENABLED) {
        return null;
      }

      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        return null;
      }

      // Verify the save belongs to the user's space
      const { data: save } = await supabaseAdmin
        .from("saves")
        .select("id")
        .eq("id", input.saveId)
        .eq("space_id", space.id)
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
        snapshot: SaveSnapshot;
        content?: SnapshotContent;
      } = {
        snapshot: transformSnapshot(snapshot),
      };

      // If content requested and snapshot is ready, fetch from storage
      if (input.includeContent && snapshot.status === "ready" && snapshot.storage_path) {
        try {
          const { data, error } = await supabaseAdmin.storage
            .from(SNAPSHOT_STORAGE_BUCKET)
            .download(snapshot.storage_path);

          if (!error && data) {
            const buffer = Buffer.from(await data.arrayBuffer());
            result.content = deserializeSnapshot(buffer);
          }
        } catch (err) {
          console.error("[snapshots] Failed to download content:", err);
        }
      }

      return result;
    }),

  /**
   * Request a new snapshot or re-snapshot for a save
   */
  requestSaveSnapshot: protectedProcedure
    .input(
      z.object({
        saveId: z.string().uuid(),
        force: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!SNAPSHOTS_ENABLED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Snapshots are disabled",
        });
      }

      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Space not found",
        });
      }

      // Verify the save belongs to the user's space
      const { data: save } = await supabaseAdmin
        .from("saves")
        .select("id, url")
        .eq("id", input.saveId)
        .eq("space_id", space.id)
        .single();

      if (!save) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Save not found",
        });
      }

      // Check rate limit
      const rateLimit = await checkUserRateLimit(ctx.userId);
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in 24 hours.`,
        });
      }

      // Check existing snapshot status
      const { data: existingSnapshot } = await supabaseAdmin
        .from("save_snapshots")
        .select("status")
        .eq("save_id", input.saveId)
        .single();

      if (existingSnapshot) {
        // If already processing, don't re-enqueue
        if (existingSnapshot.status === "processing") {
          return {
            status: "processing",
            message: "Snapshot is already being processed",
          };
        }

        // If ready and not forcing, don't re-snapshot
        if (existingSnapshot.status === "ready" && !input.force) {
          return {
            status: "ready",
            message: "Snapshot already exists. Use force=true to re-snapshot.",
          };
        }

        // Reset status for re-processing
        await supabaseAdmin
          .from("save_snapshots")
          .update({
            status: "pending",
            attempts: 0,
            error_message: null,
            blocked_reason: null,
          })
          .eq("save_id", input.saveId);
      } else {
        // Create new snapshot record
        await supabaseAdmin.from("save_snapshots").insert({
          save_id: input.saveId,
          space_id: space.id,
          status: "pending",
        });
      }

      // Enqueue the job
      const enqueueResult = await enqueueSnapshotJob(input.saveId, space.id, save.url);

      if (!enqueueResult.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: enqueueResult.error || "Failed to enqueue snapshot job",
        });
      }

      return {
        status: "pending",
        message: "Snapshot job enqueued",
        remaining: rateLimit.remaining,
      };
    }),

  /**
   * Get user's snapshot quota info
   */
  getSnapshotQuota: protectedProcedure.query(async ({ ctx }) => {
    if (!SNAPSHOTS_ENABLED) {
      return { enabled: false, used: 0, remaining: 0, limit: 0 };
    }

    const quota = await getUserSnapshotQuota(ctx.userId);
    return { enabled: true, ...quota };
  }),
});
