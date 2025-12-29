import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPublicSpace } from "@/lib/mock-data";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const spaceSlug = headersList.get("x-space-slug") || "mario";
  const space = getPublicSpace();

  const baseUrl = `https://${spaceSlug}.backpocket.my`;

  return {
    title: `${space.name} — backpocket`,
    description: space.bio || `Public collection from ${space.name}`,
    openGraph: {
      title: space.name,
      description: space.bio || `Public collection from ${space.name}`,
      type: "website",
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: space.name,
      description: space.bio || `Public collection from ${space.name}`,
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
