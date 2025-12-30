"use client";

import {
  Archive,
  Bookmark,
  Calendar,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Globe,
  Grid3X3,
  Link2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { routes } from "@/lib/constants/routes";
import { trpc } from "@/lib/trpc/client";
import type { APISave, SaveVisibility } from "@/lib/types";
import { cn, formatDate, getDomainFromUrl } from "@/lib/utils";

type ViewMode = "grid" | "list";
type FilterType = "all" | "favorites" | "archived" | "public" | "private";

function SaveListItem({
  save,
  isSelected,
  isSelectionMode,
  onSelect,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
}: {
  save: APISave;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const visibilityConfig = {
    public: { icon: Eye, label: "Public", class: "tag-mint" },
    private: { icon: EyeOff, label: "Private", class: "tag-denim" },
    unlisted: { icon: Link2, label: "Unlisted", class: "tag-amber" },
  };

  const vis = visibilityConfig[save.visibility];
  const VisIcon = vis.icon;

  return (
    <div
      className={cn(
        "group relative flex gap-4 rounded-xl border bg-card/50 p-4 transition-all duration-200",
        "hover:bg-card hover:shadow-denim",
        isSelected && "border-primary/50 bg-primary/5 shadow-denim"
      )}
    >
      {/* Checkbox - always in flow, visibility controlled */}
      <div
        className={cn(
          "flex items-center transition-all duration-200",
          isSelectionMode
            ? "w-5 opacity-100"
            : "w-0 overflow-hidden opacity-0 group-hover:w-5 group-hover:opacity-100"
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Thumbnail */}
      <Link href={`/app/saves/${save.id}`} className="shrink-0 overflow-hidden rounded-lg">
        {save.imageUrl ? (
          <div className="relative h-20 w-32 overflow-hidden rounded-lg bg-muted">
            <Image
              src={save.imageUrl}
              alt=""
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex h-20 w-32 items-center justify-center rounded-lg bg-gradient-to-br from-muted to-muted/50">
            <Bookmark className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/app/saves/${save.id}`}
              className="font-medium leading-snug text-foreground transition-colors hover:text-primary line-clamp-1"
            >
              {save.title || save.url}
            </Link>

            {/* Visibility badge */}
            <Badge className={cn("shrink-0 gap-1 text-xs", vis.class)}>
              <VisIcon className="h-3 w-3" />
              {vis.label}
            </Badge>
          </div>

          {save.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{save.description}</p>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            {getDomainFromUrl(save.url)}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {formatDate(save.savedAt)}
          </span>
          {save.tags && save.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              {save.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-secondary/80 px-2 py-0.5 text-secondary-foreground"
                >
                  {tag.name}
                </span>
              ))}
              {save.tags.length > 2 && (
                <span className="text-muted-foreground">+{save.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite();
          }}
          className={cn(
            "h-8 w-8 rounded-lg",
            save.isFavorite && "bg-amber/10 text-amber opacity-100"
          )}
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
          className={cn(
            "h-8 w-8 rounded-lg",
            save.isArchived && "bg-denim/10 text-denim opacity-100"
          )}
        >
          <Archive className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={`/app/saves/${save.id}`} className="gap-2">
                <Eye className="h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={save.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open original
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SaveGridCard({
  save,
  isSelected,
  isSelectionMode,
  onSelect,
  onToggleFavorite,
  onDelete,
}: {
  save: APISave;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const visibilityConfig = {
    public: { icon: Eye, class: "tag-mint" },
    private: { icon: EyeOff, class: "tag-denim" },
    unlisted: { icon: Link2, class: "tag-amber" },
  };

  const vis = visibilityConfig[save.visibility];
  const VisIcon = vis.icon;

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-200 card-hover relative",
        isSelected && "ring-2 ring-primary shadow-denim-lg"
      )}
    >
      {/* Checkbox overlay */}
      <div
        className={cn(
          "absolute left-3 top-3 z-10 transition-all duration-200",
          isSelectionMode
            ? "opacity-100 scale-100"
            : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="bg-background/90 backdrop-blur-sm shadow-sm"
        />
      </div>

      {/* Favorite button overlay */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          onToggleFavorite();
        }}
        className={cn(
          "absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-sm transition-all duration-200",
          save.isFavorite ? "opacity-100 text-amber" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <Star className={cn("h-4 w-4", save.isFavorite && "fill-current")} />
      </Button>

      <Link href={`/app/saves/${save.id}`}>
        {save.imageUrl ? (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <Image
              src={save.imageUrl}
              alt=""
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Bookmark className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
      </Link>

      <div className="p-4">
        <Link
          href={`/app/saves/${save.id}`}
          className="block font-medium leading-snug text-foreground transition-colors hover:text-primary line-clamp-2"
        >
          {save.title || save.url}
        </Link>

        {save.description && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{save.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            {getDomainFromUrl(save.url)}
          </span>
          <Badge className={cn("gap-1 text-xs", vis.class)}>
            <VisIcon className="h-3 w-3" />
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
          <div key={i} className="flex items-center gap-4 rounded-xl border bg-card/50 p-4">
            <Skeleton className="h-20 w-32 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
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
          <div className="p-4 space-y-3">
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      utils.space.getStats.invalidate();
      utils.space.getDashboardData.invalidate();
    },
  });

  const toggleArchive = trpc.space.toggleArchive.useMutation({
    onSuccess: () => {
      utils.space.listSaves.invalidate();
      utils.space.getDashboardData.invalidate();
    },
  });

  const deleteSave = trpc.space.deleteSave.useMutation({
    onSuccess: () => {
      utils.space.listSaves.invalidate();
      utils.space.getStats.invalidate();
      utils.space.getDashboardData.invalidate();
    },
  });

  const bulkDeleteSaves = trpc.space.bulkDeleteSaves.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      utils.space.listSaves.invalidate();
      utils.space.getStats.invalidate();
      utils.space.getDashboardData.invalidate();
    },
  });

  const isSelectionMode = selectedIds.size > 0;
  const allSelected =
    data?.items && data.items.length > 0 && selectedIds.size === data.items.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!data?.items) return;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.items.map((s) => s.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (
      confirm(
        `Are you sure you want to delete ${selectedIds.size} save${selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.`
      )
    ) {
      bulkDeleteSaves.mutate({ saveIds: Array.from(selectedIds) });
    }
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saves</h1>
          <p className="text-muted-foreground">
            {data?.items?.length ?? 0} saves in your collection
          </p>
        </div>
        <Link href={routes.app.savesNew}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Save
          </Button>
        </Link>
      </div>

      {/* Bulk actions bar */}
      {isSelectionMode && (
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-3 text-sm font-medium"
          >
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                allSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/50 hover:border-primary"
              )}
            >
              {allSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </div>
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>

          <div className="flex-1" />

          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkDeleteSaves.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {bulkDeleteSaves.isPending ? "Deleting..." : `Delete ${selectedIds.size}`}
          </Button>

          <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-2">
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}

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
          {/* Select button when not in selection mode */}
          {!isSelectionMode && data?.items && data.items.length > 0 && (
            <Button variant="outline" size="sm" onClick={selectAll} className="gap-2">
              <div className="h-4 w-4 rounded border-2 border-current" />
              Select
            </Button>
          )}

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

          <div className="flex rounded-lg border bg-muted/50 p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md"
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
              <SaveListItem
                key={save.id}
                save={save}
                isSelected={selectedIds.has(save.id)}
                isSelectionMode={isSelectionMode}
                onSelect={() => toggleSelect(save.id)}
                onToggleFavorite={() => toggleFavorite.mutate({ saveId: save.id })}
                onToggleArchive={() => toggleArchive.mutate({ saveId: save.id })}
                onDelete={() => {
                  if (confirm("Are you sure you want to delete this save?")) {
                    deleteSave.mutate({ saveId: save.id });
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((save) => (
              <SaveGridCard
                key={save.id}
                save={save}
                isSelected={selectedIds.has(save.id)}
                isSelectionMode={isSelectionMode}
                onSelect={() => toggleSelect(save.id)}
                onToggleFavorite={() => toggleFavorite.mutate({ saveId: save.id })}
                onDelete={() => {
                  if (confirm("Are you sure you want to delete this save?")) {
                    deleteSave.mutate({ saveId: save.id });
                  }
                }}
              />
            ))}
          </div>
        )
      ) : (
        <div className="py-20 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Bookmark className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="mt-6 text-lg font-medium">No saves found</h3>
          <p className="mt-2 text-muted-foreground">
            {searchQuery || filter !== "all"
              ? "Try adjusting your search or filters"
              : "Add your first save to get started"}
          </p>
          {!searchQuery && filter === "all" && (
            <Link href={routes.app.savesNew} className="mt-6 inline-block">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Save
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
