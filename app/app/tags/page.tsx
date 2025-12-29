"use client";

import { Edit, MoreHorizontal, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";

export default function TagsPage() {
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: tags, isLoading } = trpc.space.listTags.useQuery();
  const utils = trpc.useUtils();

  const createTag = trpc.space.createTag.useMutation({
    onSuccess: () => {
      utils.space.listTags.invalidate();
      setNewTagOpen(false);
      setNewName("");
    },
  });

  const deleteTag = trpc.space.deleteTag.useMutation({
    onSuccess: () => {
      utils.space.listTags.invalidate();
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createTag.mutate({ name: newName });
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
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
          <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
          <p className="text-muted-foreground">{tags?.length ?? 0} tags</p>
        </div>

        <Dialog open={newTagOpen} onOpenChange={setNewTagOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new tag</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., design"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Tags are case-insensitive</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewTagOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTag.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tags list */}
      {tags && tags.length > 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="group flex items-center gap-1 rounded-full border bg-background pl-4 pr-1 py-1 transition-colors hover:border-primary/50"
                >
                  <span className="text-sm font-medium">{tag.name}</span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {tag._count?.saves ?? 0}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteTag.mutate({ tagId: tag.id })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="py-16 text-center">
          <Tags className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No tags yet</h3>
          <p className="mt-2 text-muted-foreground">
            Tags help you organize and find your saves quickly
          </p>
          <Button className="mt-6" onClick={() => setNewTagOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Tag
          </Button>
        </div>
      )}
    </div>
  );
}
