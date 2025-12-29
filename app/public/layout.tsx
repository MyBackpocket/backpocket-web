import type { Metadata } from "next";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const spaceSlug = headersList.get("x-space-slug") || "public";

  const baseUrl = `https://${spaceSlug}.backpocket.my`;

  // TODO: Replace with real database query for space metadata
  return {
    title: "backpocket",
    description: "A public collection",
    openGraph: {
      title: "backpocket",
      description: "A public collection",
      type: "website",
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: "backpocket",
      description: "A public collection",
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
