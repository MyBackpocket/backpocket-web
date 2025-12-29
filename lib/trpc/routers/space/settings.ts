import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { supabaseAdmin } from "@/lib/supabase";
import { createSpaceForUser, getUserSpace } from "../../services/space";
import { protectedProcedure, router } from "../../trpc";

// Reserved slugs that cannot be used
const RESERVED_SLUGS = [
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "settings",
  "login",
  "logout",
  "register",
  "signup",
  "signin",
  "signout",
  "auth",
  "oauth",
  "help",
  "support",
  "docs",
  "blog",
  "about",
  "contact",
  "terms",
  "privacy",
  "public",
  "static",
  "assets",
  "images",
  "css",
  "js",
  "fonts",
  "media",
  "uploads",
  "files",
  "download",
  "downloads",
  "rss",
  "feed",
  "sitemap",
  "robots",
  "favicon",
  "manifest",
  "sw",
  "service-worker",
  "null",
  "undefined",
  "true",
  "false",
  "test",
  "demo",
  "example",
  "sample",
  "backpocket",
];

export const settingsRouter = router({
  getMySpace: protectedProcedure.query(async ({ ctx }) => {
    let space = await getUserSpace(ctx.userId, ctx.spaceCache);

    // Create space if user doesn't have one
    if (!space) {
      space = await createSpaceForUser(ctx.userId);
    }

    return space;
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        avatarUrl: z.string().optional(),
        visibility: z.enum(["public", "private"]).optional(),
        publicLayout: z.enum(["list", "grid"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.bio !== undefined) updateData.bio = input.bio;
      if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;
      if (input.publicLayout !== undefined) updateData.public_layout = input.publicLayout;

      const { data: updated, error } = await supabaseAdmin
        .from("spaces")
        .update(updateData)
        .eq("id", space.id)
        .select()
        .single();

      if (error || !updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update" });
      }

      return {
        ...space,
        ...input,
      };
    }),

  updateSlug: protectedProcedure
    .input(
      z.object({
        slug: z
          .string()
          .min(3, "Slug must be at least 3 characters")
          .max(32, "Slug must be at most 32 characters")
          .regex(
            /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
            "Slug must be lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen."
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const slug = input.slug.toLowerCase();

      if (RESERVED_SLUGS.includes(slug)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This subdomain is reserved and cannot be used",
        });
      }

      // Check for existing slug (case-insensitive)
      const { data: existingSpace } = await supabaseAdmin
        .from("spaces")
        .select("id")
        .ilike("slug", slug)
        .neq("id", space.id)
        .single();

      if (existingSpace) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This subdomain is already taken",
        });
      }

      // Update the slug
      const { data: updated, error } = await supabaseAdmin
        .from("spaces")
        .update({ slug })
        .eq("id", space.id)
        .select()
        .single();

      if (error || !updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update subdomain",
        });
      }

      return {
        ...space,
        slug: updated.slug,
      };
    }),

  // Check if a slug is available
  checkSlugAvailability: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      const slug = input.slug.toLowerCase();

      // Subset of reserved slugs for availability check
      const reservedSlugs = [
        "www",
        "app",
        "api",
        "admin",
        "dashboard",
        "settings",
        "login",
        "logout",
        "register",
        "signup",
        "signin",
        "signout",
        "auth",
        "oauth",
        "help",
        "support",
        "docs",
        "blog",
        "about",
        "contact",
        "terms",
        "privacy",
        "public",
        "static",
        "assets",
        "backpocket",
      ];

      if (reservedSlugs.includes(slug)) {
        return { available: false, reason: "reserved" as const };
      }

      // Validate format
      if (slug.length < 3) {
        return { available: false, reason: "too_short" as const };
      }
      if (slug.length > 32) {
        return { available: false, reason: "too_long" as const };
      }
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
        return { available: false, reason: "invalid_format" as const };
      }

      // Check if taken by another space
      const { data: existingSpace } = await supabaseAdmin
        .from("spaces")
        .select("id")
        .ilike("slug", slug)
        .neq("id", space?.id || "")
        .single();

      if (existingSpace) {
        return { available: false, reason: "taken" as const };
      }

      return { available: true, reason: null };
    }),
});
