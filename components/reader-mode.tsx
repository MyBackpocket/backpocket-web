"use client";

import {
  AlertCircle,
  BookOpen,
  Clock,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SnapshotContent, SnapshotStatus } from "@/lib/types";
import { getDomainFromUrl } from "@/lib/utils";

interface ReaderModeProps {
  status: SnapshotStatus | null;
  blockedReason?: string | null;
  content?: SnapshotContent | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showRefreshButton?: boolean;
  originalUrl: string;
}

export function ReaderMode({
  status,
  blockedReason,
  content,
  isLoading,
  onRefresh,
  isRefreshing,
  showRefreshButton = false,
  originalUrl,
}: ReaderModeProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Reader Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No snapshot data available
  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Reader Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <p className="text-muted-foreground">Snapshot not available for this save.</p>
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block"
            >
              <Button variant="outline" size="sm">
                Open Original
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending/Processing state
  if (status === "pending" || status === "processing") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Reader Mode
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status === "processing" ? "Processing" : "Pending"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              {status === "processing"
                ? "Creating snapshot of this page..."
                : "Snapshot queued for processing..."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Blocked state
  if (status === "blocked") {
    // Friendly messages for different block reasons
    const blockConfigs: Record<
      string,
      { title: string; description: string; icon: typeof ShieldCheck }
    > = {
      noarchive: {
        title: "Content author prefers original viewing",
        description:
          "The author of this content has requested that it not be archived. We respect their choice.",
        icon: ShieldCheck,
      },
      forbidden: {
        title: "Access restricted",
        description: "This page requires authentication or has restricted access.",
        icon: AlertCircle,
      },
      not_html: {
        title: "Not a readable page",
        description: "This link points to a file or format that can't be displayed in Reader Mode.",
        icon: AlertCircle,
      },
      too_large: {
        title: "Page too large",
        description: "This page is too large to create a snapshot. You can still view it directly.",
        icon: AlertCircle,
      },
      invalid_url: {
        title: "Unable to reach page",
        description: "We couldn't access this URL. It may be temporarily unavailable.",
        icon: AlertCircle,
      },
    };

    const config = blockedReason ? blockConfigs[blockedReason] : null;
    const BlockIcon = config?.icon || AlertCircle;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Reader Mode
          </CardTitle>
          <Badge variant="secondary" className="gap-1 text-amber-600">
            <BlockIcon className="h-3 w-3" />
            {blockedReason === "noarchive" ? "Unavailable" : "Blocked"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed p-6 text-center">
            <BlockIcon className="h-10 w-10 mx-auto text-amber-500" />
            <p className="mt-4 font-medium text-foreground">
              {config?.title || "Snapshot unavailable"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {config?.description || "We couldn't create a snapshot of this page."}
            </p>
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block"
            >
              <Button variant="default" size="sm" className="gap-2">
                View Original Content
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Failed state
  if (status === "failed") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Reader Mode
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-red-600">
              <XCircle className="h-3 w-3" />
              Failed
            </Badge>
            {showRefreshButton && onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <XCircle className="h-8 w-8 mx-auto text-red-500" />
            <p className="mt-4 text-muted-foreground">
              Failed to create snapshot. Click refresh to try again.
            </p>
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block"
            >
              <Button variant="outline" size="sm">
                Open Original
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ready state with content
  if (status === "ready" && content) {
    // Calculate reading time based on word count (average reading speed: ~200 words/min)
    const wordCount = content.textContent?.split(/\s+/).filter(Boolean).length || 0;
    const readingTime = wordCount ? Math.max(1, Math.ceil(wordCount / 200)) : null;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Reader Mode
          </CardTitle>
          <div className="flex items-center gap-2">
            {readingTime && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {readingTime} min read
              </Badge>
            )}
            {showRefreshButton && onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Re-snapshot this page"
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Disclaimer */}
          <div className="mb-4 pb-4 border-b border-dashed">
            <p className="flex items-start gap-2 text-xs text-muted-foreground/70">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {content.siteName?.toLowerCase() === "twitter" ||
              content.siteName?.toLowerCase() === "x" ? (
                <span>
                  This simplified view was extracted using{" "}
                  <a
                    href="https://developer.twitter.com/en/docs/twitter-for-websites/oembed-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    Twitter's oEmbed API
                  </a>
                  . Text may be truncated; media and replies are not included.
                </span>
              ) : (
                <span>
                  This simplified view was extracted using{" "}
                  <a
                    href="https://github.com/mozilla/readability"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    Mozilla Readability
                  </a>
                  , the same technology behind Firefox Reader View. For the complete experience,{" "}
                  <a
                    href={originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    visit the original
                  </a>
                  .
                </span>
              )}
            </p>
          </div>

          {/* Byline */}
          {content.byline && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
              <User className="h-4 w-4 shrink-0 mt-0.5" />
              {content.byline.startsWith("<a") ? (
                <span
                  className="[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Byline HTML is sanitized on server
                  dangerouslySetInnerHTML={{ __html: content.byline }}
                />
              ) : (
                <span>{content.byline}</span>
              )}
            </div>
          )}

          {/* Article content */}
          <article
            className="prose prose-neutral dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-lg prose-img:border
              prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1
              prose-code:before:content-none prose-code:after:content-none"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized on the server
            dangerouslySetInnerHTML={{ __html: content.content }}
          />

          {/* Twitter truncation notice - only show for actual tweet content, not placeholders */}
          {(content.siteName?.toLowerCase() === "twitter" ||
            content.siteName?.toLowerCase() === "x") &&
            content.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground/60 italic">
                [text may be truncated]
              </p>
            )}

          {/* Original link footer */}
          <div className="mt-8 pt-6 border-t text-center">
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-4 w-4" />
              View original at {getDomainFromUrl(originalUrl)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ready but no content loaded (storage issue or content not fetched)
  if (status === "ready") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Reader Mode
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-amber-600">
              <AlertCircle className="h-3 w-3" />
              Content Missing
            </Badge>
            {showRefreshButton && onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
            <p className="mt-4 font-medium text-foreground">Content couldn't be loaded</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The snapshot exists but the content isn't available. Try refreshing.
            </p>
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block"
            >
              <Button variant="outline" size="sm" className="gap-2">
                View Original
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

/**
 * Compact snapshot status indicator for use in lists/cards
 */
export function SnapshotStatusBadge({
  status,
  blockedReason,
}: {
  status: SnapshotStatus | null;
  blockedReason?: string | null;
}) {
  if (!status) return null;

  const configs: Record<
    SnapshotStatus,
    { icon: typeof BookOpen; label: string; className: string }
  > = {
    pending: { icon: Clock, label: "Pending", className: "text-muted-foreground" },
    processing: { icon: Loader2, label: "Processing", className: "text-blue-600" },
    ready: { icon: BookOpen, label: "Reader Mode", className: "text-green-600" },
    blocked: {
      icon: blockedReason === "noarchive" ? ShieldCheck : AlertCircle,
      label: blockedReason === "noarchive" ? "Unavailable" : "Blocked",
      className: "text-amber-600",
    },
    failed: { icon: XCircle, label: "Failed", className: "text-red-600" },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={`gap-1 ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}
