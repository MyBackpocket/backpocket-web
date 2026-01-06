"use client";

import { keepPreviousData } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  Edit,
  Eye,
  EyeOff,
  Filter,
  FolderOpen,
  Grid3X3,
  List,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { trpc } from "@/lib/trpc/client";
import type { CollectionVisibility } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";
type VisibilityFilter = "public" | "private";

const VISIBILITY_OPTIONS: { value: VisibilityFilter; label: string; icon: typeof Eye }[] = [
  { value: "public", label: "Public", icon: Eye },
  { value: "private", label: "Private", icon: EyeOff },
];

type CollectionItem = {
  id: string;
  name: string;
  visibility: "private" | "public";
  defaultTags: { id: string; name: string }[];
  _count?: { saves: number };
};

function CollectionListItem({
  collection,
  onEdit,
  onDelete,
}: {
  collection: CollectionItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const visibilityConfig = {
    public: { icon: Eye, label: "Public", class: "tag-mint" },
    private: { icon: EyeOff, label: "Private", class: "tag-denim" },
  };

  const vis = visibilityConfig[collection.visibility];
  const VisIcon = vis.icon;

  return (
    <div
      className={cn(
        "group relative flex gap-4 rounded-xl border bg-card/50 p-4 transition-all duration-200",
        "hover:bg-card hover:shadow-denim"
      )}
    >
      {/* Icon */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FolderOpen className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          <Badge className={cn("shrink-0 gap-1 text-xs", vis.class)}>
            <VisIcon className="h-3 w-3" />
            {vis.label}
          </Badge>
          <span className="font-medium leading-snug text-foreground line-clamp-1">
            {collection.name}
          </span>
        </div>

        {/* Meta row */}
        <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{collection._count?.saves ?? 0} saves</span>
          {collection.defaultTags && collection.defaultTags.length > 0 && (
            <div className="flex items-center gap-1.5">
              {collection.defaultTags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-secondary/80 px-2 py-0.5 text-secondary-foreground"
                >
                  {tag.name}
                </span>
              ))}
              {collection.defaultTags.length > 3 && (
                <span className="text-muted-foreground">+{collection.defaultTags.length - 3}</span>
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
            onEdit();
          }}
          className="h-8 w-8 rounded-lg"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit collection
            </DropdownMenuItem>
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

function CollectionGridCard({
  collection,
  onEdit,
  onDelete,
}: {
  collection: CollectionItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const visibilityConfig = {
    public: { icon: Eye, label: "Public", class: "tag-mint" },
    private: { icon: EyeOff, label: "Private", class: "tag-denim" },
  };

  const vis = visibilityConfig[collection.visibility];
  const VisIcon = vis.icon;

  return (
    <Card className="group card-hover">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{collection.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("gap-1 text-xs", vis.class)}>
                <VisIcon className="h-3 w-3" />
                {vis.label}
              </Badge>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{collection._count?.saves ?? 0} saves</p>
        {collection.defaultTags && collection.defaultTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {collection.defaultTags.map((tag) => (
              <Badge key={tag.id} variant="outline" className="gap-1 text-xs font-normal">
                <Tag className="h-2.5 w-2.5" />
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CollectionsSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border bg-card/50 p-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CollectionsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<VisibilityFilter>>(new Set());
  const [filterComboboxOpen, setFilterComboboxOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagComboboxOpen, setTagComboboxOpen] = useState(false);

  // Debounce search to avoid firing on every keystroke (300ms delay)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Debounce filters so user can select multiple without triggering query on each click
  const filtersArray = Array.from(activeFilters).sort().join(",");
  const debouncedFiltersArray = useDebounce(filtersArray, 300);
  const debouncedFilters = new Set(
    debouncedFiltersArray ? (debouncedFiltersArray.split(",") as VisibilityFilter[]) : []
  );

  // Toggle a filter option (visibility is mutually exclusive for collections)
  const toggleFilter = (option: VisibilityFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        // Public/Private are mutually exclusive
        next.clear();
        next.add(option);
      }
      return next;
    });
  };

  // Get filter button label
  const getFilterLabel = () => {
    if (activeFilters.size === 0) return "All collections";
    const filter = Array.from(activeFilters)[0];
    return VISIBILITY_OPTIONS.find((f) => f.value === filter)?.label || "Filtered";
  };

  // Create modal state
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVisibility, setNewVisibility] = useState<CollectionVisibility>("private");
  const [newDefaultTags, setNewDefaultTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

  // Edit modal state (stores the collection being edited)
  const [editCollection, setEditCollection] = useState<{
    id: string;
    name: string;
    visibility: "private" | "public";
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editVisibility, setEditVisibility] = useState<CollectionVisibility>("private");
  const [editDefaultTags, setEditDefaultTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");

  const queryOptions = {
    query: debouncedSearch || undefined,
    visibility: debouncedFilters.has("public")
      ? ("public" as CollectionVisibility)
      : debouncedFilters.has("private")
        ? ("private" as CollectionVisibility)
        : undefined,
    defaultTagId: tagFilter || undefined,
  };

  const {
    data: collections,
    isLoading,
    isFetching,
  } = trpc.space.listCollections.useQuery(queryOptions, {
    // Keep previous data visible while fetching new data (avoids UI thrash)
    placeholderData: keepPreviousData,
  });
  const { data: allTags, isLoading: isTagsLoading } = trpc.space.listTags.useQuery();
  const utils = trpc.useUtils();

  const createCollection = trpc.space.createCollection.useMutation({
    onSuccess: () => {
      utils.space.listCollections.invalidate();
      setNewCollectionOpen(false);
      setNewName("");
      setNewVisibility("private");
      setNewDefaultTags([]);
      setNewTagInput("");
    },
  });

  const updateCollection = trpc.space.updateCollection.useMutation({
    onSuccess: () => {
      utils.space.listCollections.invalidate();
      setEditCollection(null);
    },
  });

  const deleteCollection = trpc.space.deleteCollection.useMutation({
    onSuccess: () => {
      utils.space.listCollections.invalidate();
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createCollection.mutate({
      name: newName,
      visibility: newVisibility,
      defaultTagNames: newDefaultTags,
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCollection || !editName.trim()) return;
    updateCollection.mutate({
      id: editCollection.id,
      name: editName,
      visibility: editVisibility,
      defaultTagNames: editDefaultTags,
    });
  };

  const openEditModal = (collection: {
    id: string;
    name: string;
    visibility: "private" | "public";
    defaultTags: { name: string }[];
  }) => {
    setEditCollection({
      id: collection.id,
      name: collection.name,
      visibility: collection.visibility,
    });
    setEditName(collection.name);
    setEditVisibility(collection.visibility);
    setEditDefaultTags(collection.defaultTags.map((t) => t.name));
    setEditTagInput("");
  };

  const addTag = (tagName: string, isEdit: boolean) => {
    const normalized = tagName.toLowerCase().trim();
    if (!normalized) return;

    if (isEdit) {
      if (!editDefaultTags.includes(normalized)) {
        setEditDefaultTags([...editDefaultTags, normalized]);
      }
      setEditTagInput("");
    } else {
      if (!newDefaultTags.includes(normalized)) {
        setNewDefaultTags([...newDefaultTags, normalized]);
      }
      setNewTagInput("");
    }
  };

  const removeTag = (tagName: string, isEdit: boolean) => {
    if (isEdit) {
      setEditDefaultTags(editDefaultTags.filter((t) => t !== tagName));
    } else {
      setNewDefaultTags(newDefaultTags.filter((t) => t !== tagName));
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isEdit: boolean) => {
    const currentInput = isEdit ? editTagInput : newTagInput;
    const currentTags = isEdit ? editDefaultTags : newDefaultTags;

    if (e.key === "Tab" || e.key === "Enter") {
      if (currentInput.trim()) {
        e.preventDefault();
        addTag(currentInput, isEdit);
      }
    } else if (e.key === "Backspace" && !currentInput && currentTags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      if (isEdit) {
        setEditDefaultTags(editDefaultTags.slice(0, -1));
      } else {
        setNewDefaultTags(newDefaultTags.slice(0, -1));
      }
    }
  };

  const handleTagBlur = (isEdit: boolean) => {
    const currentInput = isEdit ? editTagInput : newTagInput;
    if (currentInput.trim()) {
      addTag(currentInput, isEdit);
    }
  };

  // Get tag suggestions (existing tags not already selected)
  const getTagSuggestions = (currentTags: string[], inputValue: string) => {
    if (!allTags || !inputValue.trim()) return [];
    const normalized = inputValue.toLowerCase().trim();
    return allTags
      .filter(
        (t) =>
          t.name.toLowerCase().includes(normalized) && !currentTags.includes(t.name.toLowerCase())
      )
      .slice(0, 5);
  };

  // Get the selected tag name for display
  const selectedTagName = tagFilter && allTags?.find((t) => t.id === tagFilter)?.name;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">{collections?.length ?? 0} collections</p>
        </div>

        <Dialog open={newCollectionOpen} onOpenChange={setNewCollectionOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new collection</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Must Reads"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={newVisibility}
                  onValueChange={(v) => setNewVisibility(v as CollectionVisibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTags">Default Tags</Label>
                <p className="text-xs text-muted-foreground">
                  Tags automatically applied to saves added to this collection
                </p>
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 min-h-[42px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    {newDefaultTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-xs">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag, false)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      id="defaultTags"
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => handleTagKeyDown(e, false)}
                      onBlur={() => handleTagBlur(false)}
                      placeholder={newDefaultTags.length === 0 ? "Type a tag and press Tab..." : ""}
                      className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  {newTagInput && getTagSuggestions(newDefaultTags, newTagInput).length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg">
                      {getTagSuggestions(newDefaultTags, newTagInput).map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => addTag(tag.name, false)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Press Tab or Enter to add a tag</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewCollectionOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCollection.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 pr-10"
          />
          {/* Subtle loading indicator for background fetches */}
          {isFetching && !isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Visibility filter combobox */}
          <Popover open={filterComboboxOpen} onOpenChange={setFilterComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                aria-expanded={filterComboboxOpen}
                className="w-[200px] h-10 justify-between"
              >
                <Filter className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate flex-1 text-left">{getFilterLabel()}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[160px] p-0" align="start">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {VISIBILITY_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = activeFilters.has(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => toggleFilter(option.value)}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                          />
                          <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                          {option.label}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  {activeFilters.size > 0 && (
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => setActiveFilters(new Set())}
                        className="justify-center text-center text-muted-foreground"
                      >
                        Clear filter
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Tag filter combobox with search */}
          <Popover open={tagComboboxOpen} onOpenChange={setTagComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                aria-expanded={tagComboboxOpen}
                className="w-[160px] h-10 justify-between"
                disabled={isTagsLoading || !allTags?.length}
              >
                <Tag className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate flex-1 text-left">
                  {tagFilter ? selectedTagName || "Tag" : "All tags"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tags..." />
                <CommandList>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setTagFilter(null);
                        setTagComboboxOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", !tagFilter ? "opacity-100" : "opacity-0")}
                      />
                      All tags
                    </CommandItem>
                    {allTags?.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => {
                          setTagFilter(tag.id);
                          setTagComboboxOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            tagFilter === tag.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {tag.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex h-10 items-center rounded-lg border bg-muted/50 px-1.5 gap-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Collections list/grid */}
      {isLoading ? (
        <CollectionsSkeleton viewMode={viewMode} />
      ) : collections && collections.length > 0 ? (
        viewMode === "list" ? (
          <div className="space-y-3">
            {collections.map((collection) => (
              <CollectionListItem
                key={collection.id}
                collection={collection}
                onEdit={() => openEditModal(collection)}
                onDelete={() => deleteCollection.mutate({ collectionId: collection.id })}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <CollectionGridCard
                key={collection.id}
                collection={collection}
                onEdit={() => openEditModal(collection)}
                onDelete={() => deleteCollection.mutate({ collectionId: collection.id })}
              />
            ))}
          </div>
        )
      ) : (
        <div className="py-20 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="mt-6 text-lg font-medium">No collections found</h3>
          <p className="mt-2 text-muted-foreground">
            {searchQuery || activeFilters.size > 0 || tagFilter
              ? "Try adjusting your search or filters"
              : "Create a collection to organize your saves"}
          </p>
          {!searchQuery && activeFilters.size === 0 && !tagFilter && (
            <Button className="mt-6 gap-2" onClick={() => setNewCollectionOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Collection
            </Button>
          )}
        </div>
      )}

      {/* Edit Collection Dialog */}
      <Dialog open={!!editCollection} onOpenChange={(open) => !open && setEditCollection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Must Reads"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-visibility">Visibility</Label>
              <Select
                value={editVisibility}
                onValueChange={(v) => setEditVisibility(v as CollectionVisibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-defaultTags">Default Tags</Label>
              <p className="text-xs text-muted-foreground">
                Tags automatically applied to saves added to this collection
              </p>
              <div className="relative">
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 min-h-[42px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  {editDefaultTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-xs">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag, true)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    id="edit-defaultTags"
                    type="text"
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, true)}
                    onBlur={() => handleTagBlur(true)}
                    placeholder={editDefaultTags.length === 0 ? "Type a tag and press Tab..." : ""}
                    className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                {editTagInput && getTagSuggestions(editDefaultTags, editTagInput).length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg">
                    {getTagSuggestions(editDefaultTags, editTagInput).map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => addTag(tag.name, true)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Press Tab or Enter to add a tag</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditCollection(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateCollection.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
