import { headers } from "next/headers";
import type { PublicSave, PublicSpace } from "@/lib/types";

async function getSpaceData(): Promise<PublicSpace | null> {
  // TODO: Replace with real database query
  return null;
}

async function getPublicSaves(): Promise<PublicSave[]> {
  // TODO: Replace with real database query
  return [];
}

export async function GET() {
  const headersList = await headers();
  const spaceSlug = headersList.get("x-space-slug") || "public";

  const space = await getSpaceData();
  const saves = await getPublicSaves();

  const baseUrl = `https://${spaceSlug}.backpocket.my`;

  const rssItems = saves
    .map(
      (save) => `
    <item>
      <title><![CDATA[${save.title || save.url}]]></title>
      <link>${save.url}</link>
      <guid>${baseUrl}/s/${save.id}</guid>
      <pubDate>${new Date(save.savedAt).toUTCString()}</pubDate>
      ${save.description ? `<description><![CDATA[${save.description}]]></description>` : ""}
      ${save.tags?.map((tag) => `<category>${tag}</category>`).join("") || ""}
    </item>`
    )
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${space?.name || "backpocket"}</title>
    <link>${baseUrl}</link>
    <description>${space?.bio || "A public collection"}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
