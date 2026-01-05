"use client";

import {
  Bookmark,
  Calendar,
  ChevronUp,
  ExternalLink,
  FolderOpen,
  Rss,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { LogoIcon } from "@/components/logo";
import { ThemeSwitcherCompact } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { VisitorCounter } from "@/components/visitor-counter";
import { MARKETING_URL } from "@/lib/constants/links";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { trpc } from "@/lib/trpc/client";
import { cn, formatDate, getDomainFromUrl } from "@/lib/utils";

// Serialized save type (dates come as strings from tRPC)
type SerializedPublicSave = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  savedAt: string | Date;
  tags?: string[];
};

// Assign tag colors cyclically
const tagColors = ["tag-mint", "tag-teal", "tag-amber", "tag-rust", "tag-denim"];
const getTagColor = (index: number) => tagColors[index % tagColors.length];

function PublicSpaceContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get filter state from URL
  const urlQuery = searchParams.get("q") || "";
  const urlTag = searchParams.get("tag") || "";
  const urlCollection = searchParams.get("collection") || "";

  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Mobile filter panel state
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Get space slug from current URL (subdomain handled by middleware)
  // For subdomain routing, the slug is passed via header, but on client we need to fetch
  const [spaceSlug, setSpaceSlug] = useState<string | null>(null);

  // Fetch slug from headers on mount (from middleware)
  useEffect(() => {
    // The slug is in a meta tag set by the layout, or we can infer from subdomain
    const hostname = window.location.hostname;
    const parts = hostname.split(".");

    // Check for custom domain or subdomain
    if (parts.length >= 2) {
      // Could be subdomain.domain.tld or custom.domain
      // For now, assume first part is the slug for subdomains
      const potentialSlug = parts[0];
      if (potentialSlug !== "www" && potentialSlug !== "localhost") {
        setSpaceSlug(potentialSlug);
        return;
      }
    }

    // Fallback: try to get from document if server set it
    const metaSlug = document.querySelector('meta[name="x-space-slug"]')?.getAttribute("content");
    if (metaSlug) {
      setSpaceSlug(metaSlug);
    }
  }, []);

  // Resolve space by slug
  const { data: space, isLoading: spaceLoading } = trpc.public.resolveSpaceBySlug.useQuery(
    { slug: spaceSlug || "" },
    { enabled: !!spaceSlug }
  );

  // Fetch saves with filters
  const {
    data: savesData,
    isLoading: savesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.public.listPublicSaves.useInfiniteQuery(
    {
      spaceId: space?.id || "",
      query: debouncedSearch || undefined,
      tagName: urlTag || undefined,
      collectionId: urlCollection || undefined,
      limit: 20,
    },
    {
      enabled: !!space?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Fetch tags and collections for filters
  const { data: tags } = trpc.public.listPublicTags.useQuery(
    { spaceId: space?.id || "" },
    { enabled: !!space?.id }
  );

  const { data: collections } = trpc.public.listPublicCollections.useQuery(
    { spaceId: space?.id || "" },
    { enabled: !!space?.id }
  );

  // Flatten paginated saves
  const saves = savesData?.pages.flatMap((page) => page.items) || [];

  // Update URL when filters change
  const updateFilters = useCallback(
    (updates: { q?: string; tag?: string; collection?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.q !== undefined) {
        if (updates.q) params.set("q", updates.q);
        else params.delete("q");
      }
      if (updates.tag !== undefined) {
        if (updates.tag) params.set("tag", updates.tag);
        else params.delete("tag");
      }
      if (updates.collection !== undefined) {
        if (updates.collection) params.set("collection", updates.collection);
        else params.delete("collection");
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Sync debounced search to URL
  useEffect(() => {
    if (debouncedSearch !== urlQuery) {
      updateFilters({ q: debouncedSearch });
    }
  }, [debouncedSearch, urlQuery, updateFilters]);

  const clearAllFilters = () => {
    setSearchInput("");
    router.push(pathname, { scroll: false });
  };

  const hasActiveFilters = urlQuery || urlTag || urlCollection;
  const isGridLayout = space?.publicLayout === "grid";

  // Loading state
  if (spaceLoading || !space) {
    if (spaceLoading) {
      return <PublicSpaceSkeleton />;
    }
    return <SpaceNotFound />;
  }

  return (
    <div className="min-h-screen bg-gradient-denim">
      {/* Header */}
      <header className="border-b border-denim/15 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Profile info */}
            <div className="flex items-center gap-4">
              {space.avatarUrl ? (
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0">
                  <Image
                    src={space.avatarUrl}
                    alt={space.name}
                    fill
                    className="rounded-full object-cover border-2 border-denim/20 shadow-denim"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-linear-to-br from-denim to-denim-deep text-white shadow-denim">
                  <span className="text-xl font-semibold">
                    {space.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{space.name}</h1>
                {space.bio && (
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1 max-w-md">
                    {space.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <VisitorCounter spaceId={space.id} initialCount={space.visitCount} />
              <Link
                href="/rss.xml"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-rust transition-colors"
              >
                <Rss className="h-4 w-4" />
                <span className="hidden sm:inline">RSS</span>
              </Link>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search saves..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 bg-background/50"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "sm:hidden transition-colors",
                showMobileFilters && "bg-denim/10 border-denim/30 text-denim"
              )}
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              {showMobileFilters ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <SlidersHorizontal className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filters:</span>
              {urlTag && (
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/10"
                  onClick={() => updateFilters({ tag: "" })}
                >
                  <Tag className="h-3 w-3" />
                  {urlTag}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {urlCollection && (
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/10"
                  onClick={() => updateFilters({ collection: "" })}
                >
                  <FolderOpen className="h-3 w-3" />
                  {collections?.find((c) => c.id === urlCollection)?.name || "Collection"}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Desktop */}
          <aside className="hidden sm:block w-56 shrink-0 space-y-6">
            <FilterSidebar
              tags={tags || []}
              collections={collections || []}
              selectedTag={urlTag}
              selectedCollection={urlCollection}
              onTagSelect={(tag) => updateFilters({ tag, collection: "" })}
              onCollectionSelect={(id) => updateFilters({ collection: id, tag: "" })}
            />
          </aside>

          {/* Mobile filters backdrop */}
          <div
            className={cn(
              "sm:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
              showMobileFilters ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setShowMobileFilters(false)}
            onKeyDown={(e) => e.key === "Escape" && setShowMobileFilters(false)}
          />

          {/* Mobile filters bottom sheet */}
          <div
            className={cn(
              "sm:hidden fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out",
              showMobileFilters ? "translate-y-0" : "translate-y-full"
            )}
          >
            {/* Sheet container with rounded top */}
            <div className="bg-background rounded-t-2xl shadow-2xl border-t border-denim/20">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3 border-b border-border">
                <h3 className="text-base font-semibold">Filters</h3>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Filter content */}
              <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
                <FilterSidebar
                  tags={tags || []}
                  collections={collections || []}
                  selectedTag={urlTag}
                  selectedCollection={urlCollection}
                  onTagSelect={(tag) => {
                    updateFilters({ tag, collection: "" });
                    setShowMobileFilters(false);
                  }}
                  onCollectionSelect={(id) => {
                    updateFilters({ collection: id, tag: "" });
                    setShowMobileFilters(false);
                  }}
                />
              </div>

              {/* Safe area padding for devices with home indicator */}
              <div className="h-safe-area-inset-bottom pb-6" />
            </div>
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {savesLoading ? (
              <SavesGridSkeleton isGrid={isGridLayout} />
            ) : saves.length > 0 ? (
              <>
                {isGridLayout ? (
                  <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {saves.map((save, index) => (
                      <SaveCardGrid key={save.id} save={save} index={index} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {saves.map((save, index) => (
                      <SaveCardList key={save.id} save={save} index={index} />
                    ))}
                  </div>
                )}

                {/* Load more */}
                {hasNextPage && (
                  <div className="mt-8 text-center">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState hasFilters={!!hasActiveFilters} onClear={clearAllFilters} />
            )}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-denim/15 py-8 mt-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <a
              href={MARKETING_URL}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-rust transition-colors"
            >
              <LogoIcon size="xs" />
              <span>Powered by backpocket</span>
            </a>
            <ThemeSwitcherCompact />
          </div>
        </div>
      </footer>
    </div>
  );
}

// Filter sidebar component
function FilterSidebar({
  tags,
  collections,
  selectedTag,
  selectedCollection,
  onTagSelect,
  onCollectionSelect,
}: {
  tags: { name: string; count: number }[];
  collections: { id: string; name: string; count: number }[];
  selectedTag: string;
  selectedCollection: string;
  onTagSelect: (tag: string) => void;
  onCollectionSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Tags section */}
      {tags.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
            <Tag className="h-4 w-4" />
            Tags
          </h3>
          <div className="space-y-1">
            {tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                onClick={() => onTagSelect(selectedTag === tag.name ? "" : tag.name)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors",
                  selectedTag === tag.name
                    ? "bg-denim/10 text-denim font-medium"
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                <span className="truncate">{tag.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{tag.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collections section */}
      {collections.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
            <FolderOpen className="h-4 w-4" />
            Collections
          </h3>
          <div className="space-y-1">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() =>
                  onCollectionSelect(selectedCollection === collection.id ? "" : collection.id)
                }
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors",
                  selectedCollection === collection.id
                    ? "bg-denim/10 text-denim font-medium"
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                <span className="truncate">{collection.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{collection.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tags.length === 0 && collections.length === 0 && (
        <p className="text-sm text-muted-foreground">No filters available</p>
      )}
    </div>
  );
}

// Save card components
function SaveCardGrid({ save, index }: { save: SerializedPublicSave; index: number }) {
  return (
    <Link href={`/s/${save.id}`} className="group block">
      <article
        className="rounded-xl border border-denim/15 bg-card overflow-hidden shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1 animate-slide-up"
        style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
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
          <div className="flex aspect-video w-full items-center justify-center bg-linear-to-br from-denim/5 to-denim/10">
            <Bookmark className="h-8 w-8 text-denim/30" />
          </div>
        )}
        <div className="p-4">
          <h2 className="font-medium line-clamp-2 group-hover:text-rust transition-colors">
            {save.title || save.url}
          </h2>
          {save.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{save.description}</p>
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
  );
}

function SaveCardList({ save, index }: { save: SerializedPublicSave; index: number }) {
  return (
    <Link href={`/s/${save.id}`} className="group block">
      <article
        className="flex gap-4 rounded-lg border border-denim/15 bg-card p-4 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-0.5 animate-slide-up"
        style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
      >
        {save.imageUrl && (
          <div className="relative h-20 w-28 shrink-0">
            <Image src={save.imageUrl} alt="" fill className="rounded-md object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-medium line-clamp-1 group-hover:text-rust transition-colors">
            {save.title || save.url}
          </h2>
          {save.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{save.description}</p>
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
  );
}

// Loading skeletons
function PublicSpaceSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-denim">
      <header className="border-b border-denim/15 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </div>
          </div>
          <Skeleton className="h-10 w-full mt-4" />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <div className="flex gap-6">
          <aside className="hidden sm:block w-56 space-y-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </aside>
          <main className="flex-1">
            <SavesGridSkeleton isGrid />
          </main>
        </div>
      </div>
    </div>
  );
}

function SavesGridSkeleton({ isGrid }: { isGrid: boolean }) {
  if (isGrid) {
    return (
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-denim/15 bg-card overflow-hidden">
            <Skeleton className="aspect-video w-full" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-lg border border-denim/15 bg-card p-4">
          <Skeleton className="h-20 w-28 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state
function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-16 text-center">
      <LogoIcon size="xl" className="mx-auto opacity-30" />
      {hasFilters ? (
        <>
          <p className="mt-4 text-muted-foreground">No saves match your filters.</p>
          <Button variant="outline" className="mt-4" onClick={onClear}>
            Clear filters
          </Button>
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">No public saves yet. Check back soon!</p>
      )}
    </div>
  );
}

// Space not found
function SpaceNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-denim">
      <div className="text-center">
        <LogoIcon size="xl" className="mx-auto opacity-50" />
        <h1 className="mt-4 text-2xl font-semibold">Space not found</h1>
        <p className="mt-2 text-muted-foreground">This space doesn&apos;t exist or is private.</p>
        <a href={MARKETING_URL} className="mt-6 inline-block text-sm text-rust hover:underline">
          Learn more about backpocket
        </a>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function PublicSpacePage() {
  return (
    <Suspense fallback={<PublicSpaceSkeleton />}>
      <PublicSpaceContent />
    </Suspense>
  );
}
