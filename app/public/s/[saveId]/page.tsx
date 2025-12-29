import { ArrowLeft, Calendar, ExternalLink, Globe, Rss } from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LogoIcon } from "@/components/logo";
import { ThemeSwitcherCompact } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisitTracker } from "@/components/visit-tracker";
import { createCaller } from "@/lib/trpc/caller";
import type { PublicSave, PublicSpace } from "@/lib/types";
import { formatDate, getDomainFromUrl } from "@/lib/utils";

async function getSaveData(
  spaceSlug: string,
  saveId: string
): Promise<{ space: PublicSpace | null; save: PublicSave | null }> {
  const caller = await createCaller();

  // Resolve space by slug (handles both regular slugs and custom:domain format)
  const space = await caller.public.resolveSpaceBySlug({ slug: spaceSlug });

  if (!space) {
    return { space: null, save: null };
  }

  // Get the specific save
  const save = await caller.public.getPublicSave({
    spaceId: space.id,
    saveId,
  });

  return { space, save };
}

export default async function PublicSavePermalinkPage({
  params,
}: {
  params: Promise<{ saveId: string }>;
}) {
  const { saveId } = await params;
  const headersList = await headers();
  const spaceSlug = headersList.get("x-space-slug");

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

  const { space, save } = await getSaveData(spaceSlug, saveId);

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

          {/* Tags */}
          {save.tags && save.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {save.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Description */}
          {save.description && (
            <p className="mt-8 text-lg text-muted-foreground leading-relaxed">{save.description}</p>
          )}

          {/* CTA */}
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
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-denim/15 py-8">
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <a
              href="https://backpocket.my"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-rust transition-colors"
            >
              <LogoIcon size="xs" />
              <span>Powered by backpocket</span>
            </a>
            <ThemeSwitcherCompact />
          </div>
        </div>
      </footer>
    </div>
  );
}
