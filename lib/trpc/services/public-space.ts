import { APP_DOMAIN, ROOT_DOMAIN } from "@/lib/config/public";
import { getVisitCount } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";
import type { PublicSpace } from "@/lib/types";

/**
 * Resolve a space from hostname (subdomain or custom domain).
 * Returns null if this is the main app domain or no space found.
 */
export async function resolveSpaceFromHost(hostname: string): Promise<PublicSpace | null> {
  // Remove port for local development
  const host = hostname.split(":")[0];

  // Skip if it's the main app domain
  if (host === APP_DOMAIN || host === `www.${APP_DOMAIN}`) {
    return null;
  }

  // Skip localhost without subdomain
  if (host === "localhost") {
    return null;
  }

  // Skip Vercel preview deployments
  if (host.endsWith(".vercel.app")) {
    return null;
  }

  let spaceId: string | null = null;
  let slug: string | null = null;

  // Check for subdomain pattern: {slug}.backpocket.my or {slug}.localhost
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    slug = host.replace(`.${ROOT_DOMAIN}`, "");
    if (slug === "www" || !slug) {
      return null;
    }
  } else if (host.endsWith(".localhost")) {
    slug = host.split(".localhost")[0];
    if (slug === "www" || !slug) {
      return null;
    }
  } else if (!host.includes(ROOT_DOMAIN) && !host.includes("localhost")) {
    // Custom domain case: lookup in domain_mappings
    const normalizedHost = host.startsWith("www.") ? host.slice(4) : host;

    const { data: mapping } = await supabaseAdmin
      .from("domain_mappings")
      .select("space_id, status")
      .or(`domain.eq.${normalizedHost},domain.eq.www.${normalizedHost}`)
      .eq("status", "active")
      .single();

    if (mapping) {
      spaceId = mapping.space_id;
    }
  }

  // Resolve space either by slug or by spaceId from custom domain
  let space: Record<string, unknown> | null = null;

  if (slug) {
    const { data } = await supabaseAdmin
      .from("spaces")
      .select("*")
      .eq("slug", slug)
      .eq("visibility", "public")
      .single();
    space = data;
  } else if (spaceId) {
    const { data } = await supabaseAdmin
      .from("spaces")
      .select("*")
      .eq("id", spaceId)
      .eq("visibility", "public")
      .single();
    space = data;
  }

  if (!space) {
    return null;
  }

  const visitCount = await getVisitCount(space.id as string);

  return {
    id: space.id as string,
    slug: space.slug as string,
    name: space.name as string,
    bio: space.bio as string | null,
    avatarUrl: space.avatar_url as string | null,
    publicLayout: space.public_layout as "list" | "grid",
    visitCount,
  };
}
