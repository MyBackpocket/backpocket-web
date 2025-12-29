import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserSpace } from "../../services/space";
import { protectedProcedure, router } from "../../trpc";

export const domainsRouter = router({
  listDomains: protectedProcedure.query(
    async ({
      ctx,
    }): Promise<
      Array<{
        id: string;
        domain: string;
        spaceId: string;
        status: "pending_verification" | "verified" | "active" | "error" | "disabled";
        verificationToken: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    > => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) return [];

      const { data: domains } = await supabaseAdmin
        .from("domain_mappings")
        .select("*")
        .eq("space_id", space.id)
        .order("created_at", { ascending: false });

      return (domains || []).map((d) => ({
        id: d.id as string,
        domain: d.domain as string,
        spaceId: d.space_id as string,
        status: d.status as "pending_verification" | "verified" | "active" | "error" | "disabled",
        verificationToken: d.verification_token as string | null,
        createdAt: new Date(d.created_at as string),
        updatedAt: new Date(d.updated_at as string),
      }));
    }
  ),

  addDomain: protectedProcedure
    .input(z.object({ domain: z.string().min(3) }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      // Import Vercel functions dynamically to avoid issues if not configured
      const { addDomainToProject, isVercelConfigured } = await import("@/lib/vercel");

      if (!isVercelConfigured) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Custom domains are not configured. Contact support.",
        });
      }

      // Normalize domain
      const domain = input.domain
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");

      // Check if domain already exists
      const { data: existing } = await supabaseAdmin
        .from("domain_mappings")
        .select("id")
        .eq("domain", domain)
        .single();

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This domain is already in use",
        });
      }

      // Add to Vercel
      const result = await addDomainToProject(domain);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to add domain",
        });
      }

      // Generate verification token
      const verificationToken = `backpocket-verify-${space.id.slice(0, 8)}`;

      // Store in database
      const { data: domainMapping, error } = await supabaseAdmin
        .from("domain_mappings")
        .insert({
          domain,
          space_id: space.id,
          status: result.verificationRequired ? "pending_verification" : "verified",
          verification_token: verificationToken,
        })
        .select()
        .single();

      if (error || !domainMapping) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save domain mapping",
        });
      }

      return {
        id: domainMapping.id,
        domain: domainMapping.domain,
        status: domainMapping.status,
        verificationRequired: result.verificationRequired,
        verification: result.verification,
      };
    }),

  verifyDomain: protectedProcedure
    .input(z.object({ domainId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      // Get domain mapping
      const { data: domainMapping } = await supabaseAdmin
        .from("domain_mappings")
        .select("*")
        .eq("id", input.domainId)
        .eq("space_id", space.id)
        .single();

      if (!domainMapping) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }

      const { verifyDomain, getDomainConfig, isVercelConfigured } = await import("@/lib/vercel");

      if (!isVercelConfigured) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Custom domains are not configured",
        });
      }

      // Check domain config on Vercel
      const config = await getDomainConfig(domainMapping.domain);

      if (config?.verified) {
        // Already verified, update status
        await supabaseAdmin
          .from("domain_mappings")
          .update({ status: "active" })
          .eq("id", domainMapping.id);

        return { verified: true, status: "active" as const };
      }

      // Try to verify
      const result = await verifyDomain(domainMapping.domain);

      if (result.verified) {
        await supabaseAdmin
          .from("domain_mappings")
          .update({ status: "active" })
          .eq("id", domainMapping.id);

        return { verified: true, status: "active" as const };
      }

      return {
        verified: false,
        status: domainMapping.status as "pending_verification",
        error: result.error,
      };
    }),

  getDomainStatus: protectedProcedure
    .input(z.object({ domainId: z.string() }))
    .query(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const { data: domainMapping } = await supabaseAdmin
        .from("domain_mappings")
        .select("*")
        .eq("id", input.domainId)
        .eq("space_id", space.id)
        .single();

      if (!domainMapping) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }

      const { getDomainConfig, isVercelConfigured } = await import("@/lib/vercel");

      let vercelStatus: {
        verified: boolean;
        misconfigured: boolean;
        verification?: { type: string; domain: string; value: string }[];
      } = {
        verified: false,
        misconfigured: false,
      };

      if (isVercelConfigured) {
        const config = await getDomainConfig(domainMapping.domain);
        if (config) {
          vercelStatus = {
            verified: config.verified,
            misconfigured: config.misconfigured || false,
            verification: config.verification?.map((v) => ({
              type: v.type,
              domain: v.domain,
              value: v.value,
            })),
          };

          // Auto-update status if verified
          if (config.verified && domainMapping.status !== "active") {
            await supabaseAdmin
              .from("domain_mappings")
              .update({ status: "active" })
              .eq("id", domainMapping.id);
          }
        }
      }

      return {
        id: domainMapping.id,
        domain: domainMapping.domain,
        status: vercelStatus.verified ? "active" : domainMapping.status,
        verified: vercelStatus.verified,
        misconfigured: vercelStatus.misconfigured,
        verification: vercelStatus.verification,
        createdAt: new Date(domainMapping.created_at),
      };
    }),

  removeDomain: protectedProcedure
    .input(z.object({ domainId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const space = await getUserSpace(ctx.userId, ctx.spaceCache);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }

      const { data: domainMapping } = await supabaseAdmin
        .from("domain_mappings")
        .select("*")
        .eq("id", input.domainId)
        .eq("space_id", space.id)
        .single();

      if (!domainMapping) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }

      const { removeDomainFromProject, isVercelConfigured } = await import("@/lib/vercel");

      // Remove from Vercel (if configured)
      if (isVercelConfigured) {
        await removeDomainFromProject(domainMapping.domain);
      }

      // Remove from database
      await supabaseAdmin.from("domain_mappings").delete().eq("id", domainMapping.id);

      return { success: true };
    }),
});
