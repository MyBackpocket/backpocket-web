import type { Metadata } from "next";
import { headers } from "next/headers";
import { createCaller } from "@/lib/trpc/caller";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "backpocket.my";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const spaceSlug = headersList.get("x-space-slug");

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
  if (spaceSlug.startsWith("custom:")) {
    const customDomain = spaceSlug.slice(7);
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

export default function PublicSpaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
