"use client";

import { Edit, Eye, EyeOff, FolderOpen, MoreHorizontal, Plus, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { CollectionVisibility } from "@/lib/types";

export default function CollectionsPage() {
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

  const { data: collections, isLoading } = trpc.space.listCollections.useQuery();
  const { data: allTags } = trpc.space.listTags.useQuery();
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

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
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
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">{collections?.length ?? 0} collections</p>
        </div>

        <Dialog open={newCollectionOpen} onOpenChange={setNewCollectionOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
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

      {/* Collections grid */}
      {collections && collections.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Card key={collection.id} className="group card-hover">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{collection.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        {collection.visibility === "public" ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                        {collection.visibility}
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
                    <DropdownMenuItem onClick={() => openEditModal(collection)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        deleteCollection.mutate({
                          collectionId: collection.id,
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {collection._count?.saves ?? 0} saves
                </p>
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
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No collections yet</h3>
          <p className="mt-2 text-muted-foreground">Create a collection to organize your saves</p>
          <Button className="mt-6" onClick={() => setNewCollectionOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Collection
          </Button>
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
