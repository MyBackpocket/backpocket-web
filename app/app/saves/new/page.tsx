"use client";

import { ArrowLeft, Eye, EyeOff, Folder, Link2, Loader2, Lock, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { routes } from "@/lib/constants/routes";
import { trpc } from "@/lib/trpc/client";
import type { SaveVisibility } from "@/lib/types";

const VISIBILITY_OPTIONS = [
  {
    value: "private" as const,
    label: "Private",
    description: "Only you can see this",
    icon: Lock,
  },
  {
    value: "public" as const,
    label: "Public",
    description: "Visible in your public space",
    icon: Eye,
  },
  {
    value: "unlisted" as const,
    label: "Unlisted",
    description: "Accessible via direct link only",
    icon: EyeOff,
  },
];

function NewSaveFormSkeleton() {
  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-8">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="space-y-8">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NewSaveForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get user's default save visibility from settings
  const { data: space } = trpc.space.getMySpace.useQuery();
  const defaultVisibility = space?.defaultSaveVisibility ?? "private";

  // Initialize from URL params (from QuickAdd "More options")
  const [url, setUrl] = useState(searchParams.get("url") || "");
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [visibility, setVisibility] = useState<SaveVisibility | null>(
    (searchParams.get("visibility") as SaveVisibility) || null
  );
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");

  // Use the user's default visibility if not explicitly set
  const effectiveVisibility = visibility ?? defaultVisibility;

  const { data: collections } = trpc.space.listCollections.useQuery();
  const [selectedCollection, setSelectedCollection] = useState<string>(
    searchParams.get("collection") || ""
  );

  const utils = trpc.useUtils();

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
      // Invalidate caches so the UI updates immediately
      utils.space.listSaves.invalidate();
      utils.space.getStats.invalidate();
      utils.space.getDashboardData.invalidate();
      router.push("/app/saves");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) return;

    createSave.mutate({
      url,
      title: title || undefined,
      visibility: effectiveVisibility,
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

  const selectedVisibility = VISIBILITY_OPTIONS.find((v) => v.value === effectiveVisibility);
  const VisibilityIcon = selectedVisibility?.icon || Lock;

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-xl">
        {/* Back link */}
        <div className="mb-8">
          <Link
            href={routes.app.saves}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to saves
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Add a new save</h1>
          <p className="text-muted-foreground">Save a link to read later or share with others</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL - Primary field with emphasis */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">
              URL
            </Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="pl-10 h-12 text-base"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <Input
              id="title"
              placeholder="Leave empty to auto-fetch from page"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Two column layout for Visibility and Collection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Visibility */}
            <div className="space-y-2">
              <Label htmlFor="visibility" className="text-sm font-medium">
                Visibility
              </Label>
              <Select
                value={effectiveVisibility}
                onValueChange={(v) => setVisibility(v as SaveVisibility)}
              >
                <SelectTrigger className="h-11">
                  <div className="flex items-center gap-2">
                    <VisibilityIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{selectedVisibility?.label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      textValue={option.label}
                      className="py-3"
                    >
                      <div className="flex items-start gap-3">
                        <option.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Collection */}
            <div className="space-y-2">
              <Label htmlFor="collection" className="text-sm font-medium">
                Collection
                <span className="text-muted-foreground font-normal ml-1">(optional)</span>
              </Label>
              <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                <SelectTrigger className="h-11">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="None" />
                  </div>
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
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm font-medium">
              Tags
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="tags"
                placeholder="design, productivity, reading"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <p className="text-xs text-muted-foreground">Separate tags with commas</p>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium">
              Private note
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <Textarea
              id="note"
              placeholder="Add a note for yourself..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Notes are always private, even on public saves
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button type="submit" disabled={!url || createSave.isPending} className="flex-1 h-11">
              {createSave.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
            <Button type="button" variant="ghost" asChild className="h-11">
              <Link href={routes.app.saves}>Cancel</Link>
            </Button>
          </div>
        </form>
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
