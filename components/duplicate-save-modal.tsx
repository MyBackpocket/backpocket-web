"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, ExternalLink, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { routes } from "@/lib/constants/routes";

export interface DuplicateSaveInfo {
  id: string;
  url: string;
  title: string | null;
  imageUrl: string | null;
  siteName: string | null;
  savedAt: string | Date;
}

interface DuplicateSaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateSave: DuplicateSaveInfo | null;
  /** Called when user chooses to dismiss and potentially try a different URL */
  onDismiss?: () => void;
}

export function DuplicateSaveModal({
  open,
  onOpenChange,
  duplicateSave,
  onDismiss,
}: DuplicateSaveModalProps) {
  if (!duplicateSave) return null;

  const savedAtDate =
    typeof duplicateSave.savedAt === "string"
      ? new Date(duplicateSave.savedAt)
      : duplicateSave.savedAt;

  const timeAgo = formatDistanceToNow(savedAtDate, { addSuffix: true });

  const handleDismiss = () => {
    onOpenChange(false);
    onDismiss?.();
  };

  // Extract domain for fallback display
  let domain = "";
  try {
    domain = new URL(duplicateSave.url).hostname.replace("www.", "");
  } catch {
    domain = duplicateSave.siteName || "";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Already Saved
          </DialogTitle>
          <DialogDescription>
            You saved this link {timeAgo}. Would you like to view or edit it?
          </DialogDescription>
        </DialogHeader>

        {/* Existing Save Card */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {duplicateSave.imageUrl && (
            <div className="relative aspect-video bg-muted">
              <Image src={duplicateSave.imageUrl} alt="" fill className="object-cover" />
            </div>
          )}
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-base leading-tight line-clamp-2">
              {duplicateSave.title || "Untitled"}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {duplicateSave.siteName || domain}
              <span className="text-muted-foreground/50">•</span>
              <span>Saved {timeAgo}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            <Button asChild className="flex-1" onClick={() => onOpenChange(false)}>
              <Link href={routes.app.save(duplicateSave.id)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Save
              </Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              <Link href={`${routes.app.save(duplicateSave.id)}?edit=true`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
          <Button variant="ghost" onClick={handleDismiss} className="w-full">
            Try a Different URL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
