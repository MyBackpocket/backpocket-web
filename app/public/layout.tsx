import type { Metadata } from "next";
import { headers } from "next/headers";
import { ROOT_DOMAIN } from "@/lib/config/public";
import { SPACE_SLUG_HEADER } from "@/lib/constants/headers";
import { extractCustomDomain, isCustomDomainSlug } from "@/lib/constants/public-space";
import { createCaller } from "@/lib/trpc/caller";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const spaceSlug = headersList.get(SPACE_SLUG_HEADER);

  if (!spaceSlug) {
    return {
      title: "backpocket",
      description: "A public collection",
    };
  }

  const caller = await createCaller();
  const space = await caller.public.resolveSpaceBySlug({ slug: spaceSlug });

  if (!space) {
    return {
      title: "Space not found | backpocket",
      description: "This space doesn't exist or is private.",
    };
  }

  // Determine base URL - use custom domain if present, otherwise subdomain
  let baseUrl: string;
  if (isCustomDomainSlug(spaceSlug)) {
    const customDomain = extractCustomDomain(spaceSlug);
    baseUrl = `https://${customDomain}`;
  } else {
    baseUrl = `https://${space.slug}.${ROOT_DOMAIN}`;
  }

  return {
    title: `${space.name} | backpocket`,
    description: space.bio || "A public collection",
    openGraph: {
      title: space.name,
      description: space.bio || "A public collection",
      type: "website",
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: space.name,
      description: space.bio || "A public collection",
    },
    alternates: {
      types: {
        "application/rss+xml": `${baseUrl}/rss.xml`,
      },
    },
  };
}

export default async function PublicSpaceLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const spaceSlug = headersList.get(SPACE_SLUG_HEADER);

  return (
    <>
      {/* Pass the space slug to client components via meta tag */}
      {spaceSlug && <meta name="x-space-slug" content={spaceSlug} />}
      {children}
    </>
  );
}
