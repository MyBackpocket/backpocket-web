import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Rss,
  User,
} from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LogoIcon } from "@/components/logo";
import { ScrollNavigator } from "@/components/scroll-navigator";
import { ThemeSwitcherCompact } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisitTracker } from "@/components/visit-tracker";
import { SPACE_SLUG_HEADER } from "@/lib/constants/headers";
import { MARKETING_URL } from "@/lib/constants/links";
import { createCaller } from "@/lib/trpc/caller";
import type { PublicSave, PublicSpace, SnapshotContent, SnapshotStatus } from "@/lib/types";
import { formatDate, getDomainFromUrl } from "@/lib/utils";

interface SnapshotData {
  snapshot: {
    status: SnapshotStatus;
    blockedReason: string | null;
    fetchedAt: Date | null;
    title: string | null;
    byline: string | null;
    excerpt: string | null;
    wordCount: number | null;
    language: string | null;
  };
  content?: SnapshotContent;
}

async function getSaveData(
  spaceSlug: string,
  saveId: string
): Promise<{
  space: PublicSpace | null;
  save: PublicSave | null;
  snapshot: SnapshotData | null;
}> {
  const caller = await createCaller();

  // Resolve space by slug (handles both regular slugs and custom:domain format)
  const space = await caller.public.resolveSpaceBySlug({ slug: spaceSlug });

  if (!space) {
    return { space: null, save: null, snapshot: null };
  }

  // Get the specific save and snapshot in parallel
  const [save, snapshot] = await Promise.all([
    caller.public.getPublicSave({
      spaceId: space.id,
      saveId,
    }),
    caller.public.getPublicSaveSnapshot({
      spaceId: space.id,
      saveId,
      includeContent: true,
    }),
  ]);

  return { space, save, snapshot: snapshot as SnapshotData | null };
}

export default async function PublicSavePermalinkPage({
  params,
}: {
  params: Promise<{ saveId: string }>;
}) {
  const { saveId } = await params;
  const headersList = await headers();
  const spaceSlug = headersList.get(SPACE_SLUG_HEADER);

  if (!spaceSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-warm">
        <div className="text-center">
          <LogoIcon size="xl" className="mx-auto opacity-50" />
          <h1 className="mt-4 text-2xl font-semibold">Save not found</h1>
          <p className="mt-2 text-muted-foreground">This save doesn't exist or is private.</p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to space
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { space, save, snapshot } = await getSaveData(spaceSlug, saveId);

  if (!save) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-warm">
        <div className="text-center">
          <LogoIcon size="xl" className="mx-auto opacity-50" />
          <h1 className="mt-4 text-2xl font-semibold">Save not found</h1>
          <p className="mt-2 text-muted-foreground">This save doesn't exist or is private.</p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to space
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      {/* Track visit */}
      {space && <VisitTracker spaceId={space.id} />}

      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to {space?.name || "space"}</span>
            </Link>
            <Link
              href="/rss.xml"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Rss className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="animate-slide-up">
          {/* Image */}
          {save.imageUrl && (
            <div className="relative mb-8 aspect-video overflow-hidden rounded-xl border">
              <Image src={save.imageUrl} alt="" fill className="object-cover" />
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-semibold tracking-tight">{save.title || save.url}</h1>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <a
              href={save.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Globe className="h-4 w-4" />
              <span>{save.siteName || getDomainFromUrl(save.url)}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Saved {formatDate(save.savedAt)}</span>
            </span>
          </div>

          {/* Tags - clickable to filter */}
          {save.tags && save.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {save.tags.map((tag) => (
                <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:bg-denim/20 transition-colors"
                  >
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Description */}
          {save.description && (
            <Card className="mt-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{save.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Reader Mode Content */}
          {snapshot?.snapshot?.status === "ready" && snapshot.content ? (
            <Card className="mt-8">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Reader Mode
                </CardTitle>
                <div className="flex items-center gap-2">
                  {snapshot.content.length && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {Math.max(
                        1,
                        Math.ceil(
                          (snapshot.content.textContent?.split(/\s+/).filter(Boolean).length || 0) /
                            200
                        )
                      )}{" "}
                      min read
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Disclaimer */}
                <div className="mb-4 pb-4 border-b border-dashed">
                  <p className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
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
                        href={save.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
                      >
                        visit the original
                      </a>
                      .
                    </span>
                  </p>
                </div>

                {/* Byline */}
                {snapshot.content.byline && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{snapshot.content.byline}</span>
                  </div>
                )}

                {/* Article content */}
                <article
                  className="prose prose-neutral dark:prose-invert max-w-none
                    prose-headings:font-semibold prose-headings:tracking-tight
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-img:rounded-lg prose-img:border
                    prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1
                    prose-pre:bg-muted prose-pre:border
                    prose-code:before:content-none prose-code:after:content-none
                    prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized on the server
                  dangerouslySetInnerHTML={{ __html: snapshot.content.content }}
                />

                {/* Original link at the end */}
                <div className="mt-8 pt-6 border-t text-center">
                  <a
                    href={save.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    View original at {getDomainFromUrl(save.url)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* CTA when no snapshot content */
            <div className="mt-12 rounded-xl border bg-card p-8 text-center">
              <p className="text-muted-foreground">Want to read the full article?</p>
              <a
                href={save.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block"
              >
                <Button>
                  Visit Original
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          )}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-denim/15 py-8">
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <a
              href={MARKETING_URL}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-rust transition-colors"
            >
              <LogoIcon size="xs" />
              <span>Powered by backpocket</span>
            </a>
            <ThemeSwitcherCompact />
          </div>
        </div>
      </footer>

      {/* Scroll navigation with progress and section markers */}
      <ScrollNavigator contentSelector="article" />
    </div>
  );
}
