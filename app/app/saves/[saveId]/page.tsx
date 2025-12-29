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
  Star,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { cn, formatDate, getDomainFromUrl } from "@/lib/utils";

export default function SaveDetailPage({ params }: { params: Promise<{ saveId: string }> }) {
  const { saveId } = use(params);
  const { data: save, isLoading } = trpc.space.getSave.useQuery({ saveId });
  const utils = trpc.useUtils();

  const toggleFavorite = trpc.space.toggleFavorite.useMutation({
    onSuccess: () => {
      utils.space.getSave.invalidate({ saveId });
    },
  });

  const toggleArchive = trpc.space.toggleArchive.useMutation({
    onSuccess: () => {
      utils.space.getSave.invalidate({ saveId });
    },
  });

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
          <Link href="/app/saves" className="mt-6 inline-block">
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
          href="/app/saves"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to saves
        </Link>

        {/* Image */}
        {save.imageUrl && (
          <div className="relative mb-6 aspect-video overflow-hidden rounded-xl border">
            <Image src={save.imageUrl} alt="" fill className="object-cover" />
          </div>
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
              size="icon"
              onClick={() => toggleFavorite.mutate({ saveId: save.id })}
              className={cn(save.isFavorite && "text-yellow-500")}
            >
              <Star className={cn("h-4 w-4", save.isFavorite && "fill-current")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => toggleArchive.mutate({ saveId: save.id })}
              className={cn(save.isArchived && "text-primary")}
            >
              <Archive className="h-4 w-4" />
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

        {/* Reader mode placeholder */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Reading Mode (Coming Soon)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                Preserved content and reader-mode view will appear here.
              </p>
              <a
                href={save.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block"
              >
                <Button variant="outline">
                  Open original
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Separator className="my-8" />

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
