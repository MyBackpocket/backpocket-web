"use client";

import {
  Archive,
  Bookmark,
  Eye,
  EyeOff,
  Filter,
  Grid3X3,
  Link2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { APISave, SaveVisibility } from "@/lib/types";
import { cn, formatDate, getDomainFromUrl } from "@/lib/utils";

type ViewMode = "grid" | "list";
type FilterType = "all" | "favorites" | "archived" | "public" | "private";

function SaveCard({
  save,
  viewMode,
  onToggleFavorite,
  onToggleArchive,
}: {
  save: APISave;
  viewMode: ViewMode;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
}) {
  const visibilityIcon = {
    public: <Eye className="h-3 w-3" />,
    private: <EyeOff className="h-3 w-3" />,
    unlisted: <Link2 className="h-3 w-3" />,
  };

  const visibilityLabel = {
    public: "Public",
    private: "Private",
    unlisted: "Unlisted",
  };

  if (viewMode === "list") {
    return (
      <div className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
        {save.imageUrl ? (
          <div className="relative h-16 w-24 shrink-0">
            <Image src={save.imageUrl} alt="" fill className="rounded-md object-cover" />
          </div>
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
            <Bookmark className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/app/saves/${save.id}`}
              className="font-medium hover:text-primary transition-colors line-clamp-1"
            >
              {save.title || save.url}
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="secondary" className="gap-1">
                {visibilityIcon[save.visibility]}
                {visibilityLabel[save.visibility]}
              </Badge>
            </div>
          </div>

          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
            {save.description || getDomainFromUrl(save.url)}
          </p>

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{getDomainFromUrl(save.url)}</span>
            <span>•</span>
            <span>{formatDate(save.savedAt)}</span>
            {save.tags && save.tags.length > 0 && (
              <>
                <span>•</span>
                <div className="flex gap-1">
                  {save.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                  {save.tags.length > 3 && <span>+{save.tags.length - 3}</span>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite();
            }}
            className={cn("h-8 w-8", save.isFavorite && "text-yellow-500 opacity-100")}
          >
            <Star className={cn("h-4 w-4", save.isFavorite && "fill-current")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              onToggleArchive();
            }}
            className={cn("h-8 w-8", save.isArchived && "text-primary")}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/app/saves/${save.id}`}>View details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={save.url} target="_blank" rel="noopener noreferrer">
                  Open original
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <Card className="group overflow-hidden card-hover">
      <Link href={`/app/saves/${save.id}`}>
        {save.imageUrl ? (
          <div className="relative aspect-video w-full">
            <Image src={save.imageUrl} alt="" fill className="object-cover" />
          </div>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted">
            <Bookmark className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/app/saves/${save.id}`}
            className="font-medium hover:text-primary transition-colors line-clamp-2"
          >
            {save.title || save.url}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            className={cn(
              "h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
              save.isFavorite && "opacity-100 text-yellow-500"
            )}
          >
            <Star className={cn("h-4 w-4", save.isFavorite && "fill-current")} />
          </Button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {save.description || getDomainFromUrl(save.url)}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{getDomainFromUrl(save.url)}</span>
          <Badge variant="secondary" className="gap-1">
            {visibilityIcon[save.visibility]}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

function SavesSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <Skeleton className="h-16 w-24 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function SavesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const queryOptions = {
    query: searchQuery || undefined,
    isArchived: filter === "archived" ? true : filter === "all" ? undefined : false,
    isFavorite: filter === "favorites" ? true : undefined,
    visibility:
      filter === "public"
        ? ("public" as SaveVisibility)
        : filter === "private"
          ? ("private" as SaveVisibility)
          : undefined,
    limit: 50,
  };

  const { data, isLoading } = trpc.space.listSaves.useQuery(queryOptions);
  const utils = trpc.useUtils();

  const toggleFavorite = trpc.space.toggleFavorite.useMutation({
    onSuccess: () => {
      utils.space.listSaves.invalidate();
    },
  });

  const toggleArchive = trpc.space.toggleArchive.useMutation({
    onSuccess: () => {
      utils.space.listSaves.invalidate();
    },
  });

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saves</h1>
          <p className="text-muted-foreground">{data?.items?.length ?? 0} saves</p>
        </div>
        <Link href="/app/saves/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Save
          </Button>
        </Link>
      </div>

      {/* Filters and search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search saves..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All saves</SelectItem>
              <SelectItem value="favorites">Favorites</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Saves list/grid */}
      {isLoading ? (
        <SavesSkeleton viewMode={viewMode} />
      ) : data?.items && data.items.length > 0 ? (
        viewMode === "list" ? (
          <div className="space-y-3">
            {data.items.map((save) => (
              <SaveCard
                key={save.id}
                save={save}
                viewMode={viewMode}
                onToggleFavorite={() => toggleFavorite.mutate({ saveId: save.id })}
                onToggleArchive={() => toggleArchive.mutate({ saveId: save.id })}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((save) => (
              <SaveCard
                key={save.id}
                save={save}
                viewMode={viewMode}
                onToggleFavorite={() => toggleFavorite.mutate({ saveId: save.id })}
                onToggleArchive={() => toggleArchive.mutate({ saveId: save.id })}
              />
            ))}
          </div>
        )
      ) : (
        <div className="py-16 text-center">
          <Bookmark className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No saves found</h3>
          <p className="mt-2 text-muted-foreground">
            {searchQuery || filter !== "all"
              ? "Try adjusting your search or filters"
              : "Add your first save to get started"}
          </p>
          {!searchQuery && filter === "all" && (
            <Link href="/app/saves/new" className="mt-6 inline-block">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Save
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
