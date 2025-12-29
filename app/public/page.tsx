import { Bookmark, Calendar, ExternalLink, Eye, Rss } from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LogoIcon } from "@/components/logo";
import { ThemeSwitcherCompact } from "@/components/theme-switcher";
import type { PublicSave, PublicSpace } from "@/lib/types";
import { formatDate, formatNumber, getDomainFromUrl } from "@/lib/utils";

async function getSpaceData(_slug: string): Promise<{ space: PublicSpace | null; saves: PublicSave[] }> {
  // TODO: Replace with real database queries
  return { space: null, saves: [] };
}

export default async function PublicSpacePage() {
  const headersList = await headers();
  const spaceSlug = headersList.get("x-space-slug");

  // If accessed via subdomain, use root-relative paths; otherwise use /public prefix
  const basePath = spaceSlug ? "" : "/public";

  const { space, saves } = await getSpaceData(spaceSlug || "mario");

  if (!space) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-denim">
        <div className="text-center">
          <LogoIcon size="xl" className="mx-auto opacity-50" />
          <h1 className="mt-4 text-2xl font-semibold">Space not found</h1>
          <p className="mt-2 text-muted-foreground">This space doesn&apos;t exist or is private.</p>
          <Link
            href="https://backpocket.my"
            className="mt-6 inline-block text-sm text-rust hover:underline"
          >
            Learn more about backpocket
          </Link>
        </div>
      </div>
    );
  }

  const isGridLayout = space.publicLayout === "grid";

  // Assign tag colors cyclically
  const tagColors = ["tag-mint", "tag-teal", "tag-amber", "tag-rust", "tag-denim"];
  const getTagColor = (index: number) => tagColors[index % tagColors.length];

  return (
    <div className="min-h-screen bg-gradient-denim">
      {/* Header */}
      <header className="border-b border-denim/15 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:justify-between gap-6">
            {/* Profile info */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {space.avatarUrl ? (
                <div className="relative h-16 w-16 shrink-0">
                  <Image
                    src={space.avatarUrl}
                    alt={space.name}
                    fill
                    className="rounded-full object-cover border-2 border-denim/20 shadow-denim"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-denim to-denim-deep text-white shadow-denim">
                  <span className="text-2xl font-semibold">
                    {space.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{space.name}</h1>
                {space.bio && <p className="mt-1 text-muted-foreground max-w-md">{space.bio}</p>}
              </div>
            </div>

            {/* Visitor counter + RSS + Theme */}
            <div className="flex items-center gap-3">
              <div className="visitor-counter">
                <Eye className="h-4 w-4" />
                <span>{formatNumber(space.visitCount)} visits</span>
              </div>
              <Link
                href={`${basePath}/rss.xml`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-rust transition-colors"
              >
                <Rss className="h-4 w-4" />
                <span>RSS</span>
              </Link>
              <ThemeSwitcherCompact />
            </div>
          </div>
        </div>
      </header>

      {/* Saves */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {saves.length > 0 ? (
          isGridLayout ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {saves.map((save, index) => (
                <Link key={save.id} href={`${basePath}/s/${save.id}`} className="group block">
                  <article
                    className="rounded-xl border border-denim/15 bg-card overflow-hidden shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1 animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {save.imageUrl ? (
                      <div className="relative aspect-video w-full overflow-hidden">
                        <Image
                          src={save.imageUrl}
                          alt=""
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-denim/5 to-denim/10">
                        <Bookmark className="h-8 w-8 text-denim/30" />
                      </div>
                    )}
                    <div className="p-4">
                      <h2 className="font-medium line-clamp-2 group-hover:text-rust transition-colors">
                        {save.title || save.url}
                      </h2>
                      {save.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {save.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{getDomainFromUrl(save.url)}</span>
                        <span>•</span>
                        <span>{formatDate(save.savedAt)}</span>
                      </div>
                      {save.tags && save.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {save.tags.slice(0, 3).map((tag, tagIndex) => (
                            <span
                              key={tag}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTagColor(tagIndex)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {saves.map((save, index) => (
                <Link key={save.id} href={`${basePath}/s/${save.id}`} className="group block">
                  <article
                    className="flex gap-4 rounded-lg border border-denim/15 bg-card p-4 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-0.5 animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {save.imageUrl && (
                      <div className="relative h-20 w-28 shrink-0">
                        <Image
                          src={save.imageUrl}
                          alt=""
                          fill
                          className="rounded-md object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-medium line-clamp-1 group-hover:text-rust transition-colors">
                        {save.title || save.url}
                      </h2>
                      {save.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {save.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {getDomainFromUrl(save.url)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(save.savedAt)}
                        </span>
                      </div>
                      {save.tags && save.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {save.tags.map((tag, tagIndex) => (
                            <span
                              key={tag}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTagColor(tagIndex)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className="py-16 text-center">
            <LogoIcon size="xl" className="mx-auto opacity-30" />
            <p className="mt-4 text-muted-foreground">No public saves yet. Check back soon!</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-denim/15 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <a
            href="https://backpocket.my"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-rust transition-colors"
          >
            <LogoIcon size="xs" />
            <span>Powered by backpocket</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
