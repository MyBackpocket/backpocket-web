"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import type { SaveVisibility } from "@/lib/types";

function NewSaveFormSkeleton() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Skeleton className="h-5 w-28" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NewSaveForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from URL params (from QuickAdd "More options")
  const [url, setUrl] = useState(searchParams.get("url") || "");
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [visibility, setVisibility] = useState<SaveVisibility>(
    (searchParams.get("visibility") as SaveVisibility) || "private"
  );
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");

  const { data: collections } = trpc.space.listCollections.useQuery();
  const [selectedCollection, setSelectedCollection] = useState<string>(
    searchParams.get("collection") || ""
  );

  // Update state if search params change
  useEffect(() => {
    const urlParam = searchParams.get("url");
    const titleParam = searchParams.get("title");
    const visibilityParam = searchParams.get("visibility") as SaveVisibility;
    const collectionParam = searchParams.get("collection");

    if (urlParam) setUrl(urlParam);
    if (titleParam) setTitle(titleParam);
    if (visibilityParam) setVisibility(visibilityParam);
    if (collectionParam) setSelectedCollection(collectionParam);
  }, [searchParams]);

  const createSave = trpc.space.createSave.useMutation({
    onSuccess: () => {
      router.push("/app/saves");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) return;

    createSave.mutate({
      url,
      title: title || undefined,
      visibility,
      collectionIds:
        selectedCollection && selectedCollection !== "none" ? [selectedCollection] : undefined,
      tagNames: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      note: note || undefined,
    });
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/app/saves"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to saves
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add a new save</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="Leave empty to auto-fetch"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If left empty, we'll fetch the title from the page
                </p>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as SaveVisibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <div className="flex flex-col">
                        <span>Private</span>
                        <span className="text-xs text-muted-foreground">Only you can see this</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="public">
                      <div className="flex flex-col">
                        <span>Public</span>
                        <span className="text-xs text-muted-foreground">
                          Visible in your public space
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="unlisted">
                      <div className="flex flex-col">
                        <span>Unlisted</span>
                        <span className="text-xs text-muted-foreground">
                          Accessible via direct link only
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Collection */}
              <div className="space-y-2">
                <Label htmlFor="collection">Collection (optional)</Label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {collections?.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (optional)</Label>
                <Input
                  id="tags"
                  placeholder="design, productivity, reading"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Separate tags with commas</p>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="note">Private note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="Add a note for yourself..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Notes are always private, even on public saves
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={!url || createSave.isPending} className="flex-1">
                  {createSave.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
                <Link href="/app/saves">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NewSavePage() {
  return (
    <Suspense fallback={<NewSaveFormSkeleton />}>
      <NewSaveForm />
    </Suspense>
  );
}
