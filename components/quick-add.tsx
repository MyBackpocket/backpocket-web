"use client";

import {
  Check,
  ChevronDown,
  Globe,
  Info,
  Link as LinkIcon,
  Loader2,
  Lock,
  Plus,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type DuplicateSaveInfo, DuplicateSaveModal } from "@/components/duplicate-save-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import type { SaveVisibility } from "@/lib/types";

type QuickAddState = "idle" | "loading" | "preview" | "saving" | "success";

interface FetchedMetadata {
  title: string;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  favicon: string | null;
}

const PLACEHOLDER_PHRASES = [
  "Analyzing page content",
  "Extracting key details",
  "Reading metadata",
  "Processing page info",
  "Gathering description",
];

function AnimatedDescriptionPlaceholder() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Cycle through phrases
    const phraseInterval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % PLACEHOLDER_PHRASES.length);
    }, 2400);

    // Animate dots
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : `${prev}.`));
    }, 400);

    return () => {
      clearInterval(phraseInterval);
      clearInterval(dotInterval);
    };
  }, []);

  return (
    <div className="space-y-2">
      {/* Skeleton container with cycling text */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <span className="text-sm text-muted-foreground/70 italic">
            {PLACEHOLDER_PHRASES[phraseIndex]}
            {dots}
          </span>
        </div>
        {/* Skeleton lines to simulate description */}
        <div className="mt-2 space-y-1.5">
          <div className="h-2.5 bg-muted/60 rounded animate-pulse w-full" />
          <div className="h-2.5 bg-muted/60 rounded animate-pulse w-4/5" />
        </div>
      </div>
      {/* Background processing disclaimer */}
      <div className="flex items-start gap-1.5 pt-1">
        <Info className="h-3 w-3 text-muted-foreground/50 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/50">
          You can close this — we'll continue processing in the background
        </p>
      </div>
    </div>
  );
}

export function QuickAdd() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<QuickAddState>("idle");
  const [metadata, setMetadata] = useState<FetchedMetadata | null>(null);
  const [visibility, setVisibility] = useState<SaveVisibility | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [duplicateSave, setDuplicateSave] = useState<DuplicateSaveInfo | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Get user's default save visibility from settings
  const { data: space } = trpc.space.getMySpace.useQuery();
  const defaultVisibility = space?.defaultSaveVisibility ?? "private";
  const effectiveVisibility = visibility ?? defaultVisibility;

  // Prevent hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: collections } = trpc.space.listCollections.useQuery(undefined, {
    enabled: open,
  });

  const utils = trpc.useUtils();

  const createSave = trpc.space.createSave.useMutation({
    onSuccess: () => {
      setState("success");
      // Invalidate caches so the UI updates immediately
      utils.space.listSaves.invalidate();
      utils.space.getStats.invalidate();
      utils.space.getDashboardData.invalidate();
      // Auto-close after 3 seconds if description data isn't available
      // (in production this would poll for snapshot, but since we use mock data, just auto-close)
      const timer = setTimeout(() => {
        resetAndClose();
      }, 3000);
      setAutoCloseTimer(timer);
    },
    onError: (error) => {
      // Check if this is a duplicate error (cause is added by our error formatter)
      const data = error.data as
        | { cause?: { type?: string; existingSave?: DuplicateSaveInfo } }
        | undefined;
      if (data?.cause?.type === "DUPLICATE_SAVE" && data.cause.existingSave) {
        setDuplicateSave(data.cause.existingSave);
        setShowDuplicateModal(true);
        setState("idle");
      } else {
        setState("preview");
      }
    },
  });

  const resetAndClose = useCallback(() => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
    }
    setOpen(false);
    setUrl("");
    setState("idle");
    setMetadata(null);
    setVisibility(null);
    setSelectedCollection(null);
    setDuplicateSave(null);
    setShowDuplicateModal(false);
    setAutoCloseTimer(null);
  }, [autoCloseTimer]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Simulate metadata fetching (in real app, this would call an API)
  const fetchMetadata = useCallback(async (inputUrl: string) => {
    setState("loading");

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Extract domain for mock data
    let domain = "example.com";
    try {
      domain = new URL(inputUrl).hostname.replace("www.", "");
    } catch {
      // Invalid URL, use default
    }

    // Generate mock metadata based on URL
    const mockMetadata: FetchedMetadata = {
      title: generateTitleFromUrl(inputUrl),
      description: null, // Real API would fetch actual meta description
      siteName: domain.charAt(0).toUpperCase() + domain.slice(1).split(".")[0],
      imageUrl: inputUrl.includes("youtube")
        ? "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
        : null,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    };

    setMetadata(mockMetadata);
    setState("preview");
  }, []);

  // Handle paste event for instant URL detection
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text");
      if (isValidUrl(pastedText) && state === "idle") {
        e.preventDefault();
        setUrl(pastedText);
        fetchMetadata(pastedText);
      }
    },
    [state, fetchMetadata]
  );

  // Handle manual submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (url && isValidUrl(url) && state === "idle") {
        fetchMetadata(url);
      }
    },
    [url, state, fetchMetadata]
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (!metadata) return;

    setState("saving");
    createSave.mutate({
      url,
      title: metadata.title,
      visibility: effectiveVisibility,
      collectionIds: selectedCollection ? [selectedCollection] : undefined,
    });
  }, [url, metadata, effectiveVisibility, selectedCollection, createSave]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.metaKey && state === "preview") {
        handleSave();
      }
      if (e.key === "Escape") {
        if (state === "preview") {
          setState("idle");
          setMetadata(null);
          setUrl("");
          inputRef.current?.focus();
        } else {
          resetAndClose();
        }
      }
    },
    [state, handleSave, resetAndClose]
  );

  const selectedCollectionName = collections?.find((c) => c.id === selectedCollection)?.name;

  const handleDuplicateDismiss = useCallback(() => {
    setDuplicateSave(null);
    setUrl("");
    setMetadata(null);
    setState("idle");
    // Re-focus input after dismissing duplicate modal
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Render a static button during SSR to prevent hydration mismatch with Radix UI
  if (!mounted) {
    return (
      <Button className="w-full gap-2" disabled>
        <Plus className="h-4 w-4" />
        Quick Add
      </Button>
    );
  }

  return (
    <>
      <DuplicateSaveModal
        open={showDuplicateModal}
        onOpenChange={(open) => {
          setShowDuplicateModal(open);
          if (!open) {
            resetAndClose();
          }
        }}
        duplicateSave={duplicateSave}
        onDismiss={handleDuplicateDismiss}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Quick Add
          </Button>
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-lg"
          onKeyDown={handleKeyDown}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              {state === "success" ? "Saved!" : "Quick Add"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* URL Input - Always visible in idle state */}
            {(state === "idle" || state === "loading") && (
              <form onSubmit={handleSubmit}>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    type="url"
                    placeholder="Paste any URL..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onPaste={handlePaste}
                    disabled={state === "loading"}
                    className="pr-10 h-12 text-base"
                    autoComplete="off"
                  />
                  {state === "loading" ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    url &&
                    isValidUrl(url) && (
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3"
                      >
                        Fetch
                      </Button>
                    )
                  )}
                </div>
                {state === "loading" && (
                  <p className="text-sm text-muted-foreground mt-2 animate-pulse">
                    Fetching page info...
                  </p>
                )}
              </form>
            )}

            {/* Preview Card */}
            {(state === "preview" || state === "saving" || state === "success") && metadata && (
              <div className="space-y-4">
                {/* Fetched Content Preview */}
                <div className="rounded-lg border bg-card overflow-hidden">
                  {metadata.imageUrl && (
                    <div className="relative aspect-video bg-muted">
                      <Image src={metadata.imageUrl} alt="" fill className="object-cover" />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      {metadata.favicon && (
                        <div className="relative w-5 h-5 shrink-0 mt-0.5">
                          <Image
                            src={metadata.favicon}
                            alt=""
                            fill
                            className="rounded object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base leading-tight line-clamp-2">
                          {metadata.title}
                        </h3>
                        {metadata.description ? (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {metadata.description}
                          </p>
                        ) : (
                          <div className="mt-2">
                            <AnimatedDescriptionPlaceholder />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {metadata.siteName || new URL(url).hostname}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Options */}
                {state !== "success" && (
                  <div className="flex items-center gap-2">
                    {/* Visibility Toggle */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={state === "saving"}
                        >
                          {effectiveVisibility === "private" ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <Globe className="h-3.5 w-3.5" />
                          )}
                          {effectiveVisibility === "private" ? "Private" : "Public"}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setVisibility("private")}>
                          <Lock className="h-4 w-4 mr-2" />
                          Private
                          {effectiveVisibility === "private" && (
                            <Check className="h-4 w-4 ml-auto" />
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setVisibility("public")}>
                          <Globe className="h-4 w-4 mr-2" />
                          Public
                          {effectiveVisibility === "public" && (
                            <Check className="h-4 w-4 ml-auto" />
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Collection Picker */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={state === "saving"}
                        >
                          {selectedCollectionName || "No collection"}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setSelectedCollection(null)}>
                          No collection
                          {!selectedCollection && <Check className="h-4 w-4 ml-auto" />}
                        </DropdownMenuItem>
                        {collections && collections.length > 0 && <DropdownMenuSeparator />}
                        {collections?.map((col) => (
                          <DropdownMenuItem
                            key={col.id}
                            onClick={() => setSelectedCollection(col.id)}
                          >
                            {col.name}
                            {selectedCollection === col.id && <Check className="h-4 w-4 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex-1" />

                    {/* Edit link */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Navigate to full form with pre-filled data
                        const params = new URLSearchParams({
                          url,
                          title: metadata.title,
                          visibility: effectiveVisibility,
                        });
                        if (selectedCollection) {
                          params.set("collection", selectedCollection);
                        }
                        router.push(`/app/saves/new?${params.toString()}`);
                        resetAndClose();
                      }}
                      disabled={state === "saving"}
                    >
                      More options
                    </Button>
                  </div>
                )}

                {/* Save Button */}
                <Button
                  onClick={handleSave}
                  disabled={state === "saving" || state === "success"}
                  className="w-full h-11"
                >
                  {state === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {state === "success" && <Check className="mr-2 h-4 w-4 text-green-500" />}
                  {state === "success" ? "Saved!" : state === "saving" ? "Saving..." : "Save"}
                  {state === "preview" && <span className="ml-2 text-xs opacity-70">⌘↵</span>}
                </Button>

                {/* Auto-close notice when still processing */}
                {state === "success" && !metadata?.description && (
                  <p className="text-center text-xs text-muted-foreground animate-in fade-in">
                    Closing automatically — processing continues in the background
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper functions
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function generateTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Common patterns
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return "YouTube Video";
    }
    if (url.includes("twitter.com") || url.includes("x.com")) {
      return "Tweet";
    }
    if (url.includes("github.com")) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]} - GitHub`;
      }
    }

    // Extract from path
    const lastSegment = path.split("/").filter(Boolean).pop();
    if (lastSegment) {
      return lastSegment
        .replace(/[-_]/g, " ")
        .replace(/\.\w+$/, "")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    return urlObj.hostname;
  } catch {
    return "Untitled";
  }
}
