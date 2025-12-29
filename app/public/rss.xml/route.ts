import { headers } from "next/headers";
import { getPublicSaves, getPublicSpace } from "@/lib/mock-data";

export async function GET() {
  const headersList = await headers();
  const spaceSlug = headersList.get("x-space-slug") || "mario";

  const space = getPublicSpace();
  const saves = getPublicSaves();

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
    <title>${space.name}</title>
    <link>${baseUrl}</link>
    <description>${space.bio || `Public saves from ${space.name}`}</description>
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
