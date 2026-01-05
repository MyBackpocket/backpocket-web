"use client";

import {
  Archive,
  ArrowLeft,
  Calendar,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Link2,
  Loader2,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useState } from "react";
import { ReaderMode } from "@/components/reader-mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/lib/constants/routes";
import { trpc } from "@/lib/trpc/client";
import { cn, formatDate, getDomainFromUrl } from "@/lib/utils";

const IS_DEV = process.env.NODE_ENV === "development";

export default function SaveDetailPage({ params }: { params: Promise<{ saveId: string }> }) {
  const { saveId } = use(params);
  const router = useRouter();
  const { data: save, isLoading } = trpc.space.getSave.useQuery({ saveId });
  const utils = trpc.useUtils();

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    visibility: "private" as "private" | "public" | "unlisted",
  });

  // Query snapshot data with content
  const { data: snapshotData, isLoading: isSnapshotLoading } = trpc.space.getSaveSnapshot.useQuery(
    { saveId, includeContent: true },
    {
      enabled: !!save,
      // Poll every 2 seconds while snapshot is pending/processing
      refetchInterval: (query) => {
        const status = query.state.data?.snapshot?.status;
        if (status === "pending" || status === "processing") {
          return 2000; // Poll every 2 seconds
        }
        return false; // Stop polling when ready/failed/blocked
      },
    }
  );

  const toggleFavorite = trpc.space.toggleFavorite.useMutation({
    onMutate: async ({ saveId: id }) => {
      // Cancel outgoing refetches
      await utils.space.getSave.cancel({ saveId: id });

      // Snapshot previous value
      const previousSave = utils.space.getSave.getData({ saveId: id });

      // Optimistically update
      if (previousSave) {
        utils.space.getSave.setData(
          { saveId: id },
          {
            ...previousSave,
            isFavorite: !previousSave.isFavorite,
          }
        );
      }

      return { previousSave };
    },
    onError: (_err, { saveId: id }, context) => {
      // Roll back on error
      if (context?.previousSave) {
        utils.space.getSave.setData({ saveId: id }, context.previousSave);
      }
    },
    onSettled: () => {
      utils.space.getSave.invalidate({ saveId });
      utils.space.listSaves.invalidate();
      utils.space.getStats.invalidate();
      utils.space.getDashboardData.invalidate();
    },
  });

  const toggleArchive = trpc.space.toggleArchive.useMutation({
    onMutate: async ({ saveId: id }) => {
      // Cancel outgoing refetches
      await utils.space.getSave.cancel({ saveId: id });

      // Snapshot previous value
      const previousSave = utils.space.getSave.getData({ saveId: id });

      // Optimistically update
      if (previousSave) {
        utils.space.getSave.setData(
          { saveId: id },
          {
            ...previousSave,
            isArchived: !previousSave.isArchived,
          }
        );
      }

      return { previousSave };
    },
    onError: (_err, { saveId: id }, context) => {
      // Roll back on error
      if (context?.previousSave) {
        utils.space.getSave.setData({ saveId: id }, context.previousSave);
      }
    },
    onSettled: () => {
      utils.space.getSave.invalidate({ saveId });
      utils.space.listSaves.invalidate();
      utils.space.getDashboardData.invalidate();
    },
  });

  const deleteSave = trpc.space.deleteSave.useMutation({
    onSuccess: () => {
      // Invalidate caches so lists show updated data immediately
      utils.space.listSaves.invalidate();
      utils.space.getStats.invalidate();
      utils.space.getDashboardData.invalidate();
      router.push(routes.app.saves);
    },
  });

  const updateSave = trpc.space.updateSave.useMutation({
    onSuccess: () => {
      // Invalidate caches so lists show updated data immediately
      utils.space.getSave.invalidate({ saveId });
      utils.space.listSaves.invalidate();
      utils.space.getDashboardData.invalidate();
      setShowEditDialog(false);
    },
  });

  const handleOpenEditDialog = useCallback(() => {
    if (save) {
      setEditForm({
        title: save.title || "",
        description: save.description || "",
        visibility: save.visibility,
      });
      setShowEditDialog(true);
    }
  }, [save]);

  const handleSaveEdit = useCallback(() => {
    updateSave.mutate({
      id: saveId,
      title: editForm.title || undefined,
      description: editForm.description || undefined,
      visibility: editForm.visibility,
    });
  }, [saveId, editForm, updateSave]);

  const handleConfirmDelete = useCallback(() => {
    deleteSave.mutate({ saveId });
  }, [saveId, deleteSave]);

  const requestSnapshot = trpc.space.requestSaveSnapshot.useMutation({
    onSuccess: () => {
      utils.space.getSaveSnapshot.invalidate({ saveId });
    },
  });

  const handleRefreshSnapshot = useCallback(() => {
    requestSnapshot.mutate({ saveId, force: true });
  }, [saveId, requestSnapshot]);

  // Dev-only: Direct snapshot trigger (bypasses QStash)
  const [isDevTriggering, setIsDevTriggering] = useState(false);
  const [devTriggerResult, setDevTriggerResult] = useState<string | null>(null);

  const handleDevTriggerSnapshot = useCallback(async () => {
    setIsDevTriggering(true);
    setDevTriggerResult(null);
    try {
      const res = await fetch("/api/dev/trigger-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveId }),
      });
      const data = await res.json();
      setDevTriggerResult(
        data.status === "ready"
          ? "✓ Snapshot ready!"
          : `${data.status}: ${data.message || data.reason}`
      );
      // Refresh snapshot data
      utils.space.getSaveSnapshot.invalidate({ saveId });
      utils.space.getSave.invalidate({ saveId });
    } catch (err) {
      setDevTriggerResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsDevTriggering(false);
    }
  }, [saveId, utils]);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="aspect-video w-full rounded-xl mb-6" />
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/4 mb-6" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!save) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-3xl text-center py-16">
          <h2 className="text-xl font-semibold">Save not found</h2>
          <p className="mt-2 text-muted-foreground">
            This save may have been deleted or doesn't exist.
          </p>
          <Link href={routes.app.saves} className="mt-6 inline-block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to saves
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const visibilityConfig = {
    public: { icon: Eye, label: "Public", color: "text-green-600" },
    private: { icon: EyeOff, label: "Private", color: "text-muted-foreground" },
    unlisted: { icon: Link2, label: "Unlisted", color: "text-yellow-600" },
  };

  const visibility = visibilityConfig[save.visibility];

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          href={routes.app.saves}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to saves
        </Link>

        {/* Image - links to source */}
        {save.imageUrl && (
          <a
            href={save.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/image relative mb-6 block aspect-video overflow-hidden rounded-xl border transition-all hover:shadow-lg"
          >
            <Image src={save.imageUrl} alt="" fill className="object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/image:bg-black/10">
              <ExternalLink className="h-8 w-8 text-white opacity-0 drop-shadow-lg transition-opacity group-hover/image:opacity-100" />
            </div>
          </a>
        )}

        {/* Title and actions */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{save.title || save.url}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <a
                href={save.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                {getDomainFromUrl(save.url)}
                <ExternalLink className="h-3 w-3" />
              </a>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(save.savedAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleFavorite.mutate({ saveId: save.id })}
              className={cn(save.isFavorite && "text-yellow-500")}
            >
              <Star className={cn("mr-2 h-4 w-4", save.isFavorite && "fill-current")} />
              {save.isFavorite ? "Unfavorite" : "Favorite"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleArchive.mutate({ saveId: save.id })}
              className={cn(save.isArchived && "text-primary")}
            >
              <Archive className="mr-2 h-4 w-4" />
              {save.isArchived ? "Unarchive" : "Archive"}
            </Button>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Badge variant="secondary" className={cn("gap-1", visibility.color)}>
            <visibility.icon className="h-3 w-3" />
            {visibility.label}
          </Badge>
          {save.isFavorite && (
            <Badge variant="secondary" className="gap-1 text-yellow-600">
              <Star className="h-3 w-3 fill-current" />
              Favorite
            </Badge>
          )}
          {save.isArchived && (
            <Badge variant="secondary" className="gap-1">
              <Archive className="h-3 w-3" />
              Archived
            </Badge>
          )}
        </div>

        {/* Description */}
        {save.description && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">{save.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {save.tags && save.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {save.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tags</p>
              )}
            </CardContent>
          </Card>

          {/* Collections */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Collections</CardTitle>
            </CardHeader>
            <CardContent>
              {save.collections && save.collections.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {save.collections.map((col) => (
                    <Badge key={col.id} variant="secondary">
                      {col.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No collections</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reader Mode */}
        <div className="mt-6">
          <ReaderMode
            status={snapshotData?.snapshot?.status ?? null}
            blockedReason={snapshotData?.snapshot?.blockedReason}
            content={snapshotData?.content}
            isLoading={isSnapshotLoading}
            onRefresh={handleRefreshSnapshot}
            isRefreshing={requestSnapshot.isPending}
            showRefreshButton={true}
            originalUrl={save.url}
          />
        </div>

        {/* Dev-only: Manual snapshot trigger */}
        {IS_DEV && (
          <Card className="mt-6 border-dashed border-yellow-500/50 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-600">
                <Zap className="h-4 w-4" />
                Dev Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDevTriggerSnapshot}
                disabled={isDevTriggering}
                className="border-yellow-500/50 hover:bg-yellow-500/10"
              >
                {isDevTriggering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Trigger Snapshot Now
                  </>
                )}
              </Button>
              {devTriggerResult && (
                <span
                  className={cn(
                    "text-sm",
                    devTriggerResult.startsWith("✓") ? "text-green-600" : "text-muted-foreground"
                  )}
                >
                  {devTriggerResult}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Separator className="my-8" />

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this save?</DialogTitle>
              <DialogDescription>
                This will permanently delete "{save.title || save.url}". This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteSave.isPending}
              >
                {deleteSave.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit save</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter a title..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Add a description..."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={editForm.visibility}
                  onValueChange={(value: "private" | "public" | "unlisted") =>
                    setEditForm((prev) => ({ ...prev, visibility: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <span className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4" />
                        Private
                      </span>
                    </SelectItem>
                    <SelectItem value="public">
                      <span className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Public
                      </span>
                    </SelectItem>
                    <SelectItem value="unlisted">
                      <span className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Unlisted
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateSave.isPending}>
                {updateSave.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
