"use client";

import {
  Archive,
  ArrowLeft,
  Calendar,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Globe,
  Hand,
  Loader2,
  Pencil,
  Plus,
  Star,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { ReaderMode } from "@/components/reader-mode";
import { ScrollNavigator } from "@/components/scroll-navigator";
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
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/lib/constants/routes";
import { trpc } from "@/lib/trpc/client";
import { cn, formatDate, getDomainFromUrl } from "@/lib/utils";

// ============================================================================
// Inline Editable Components
// ============================================================================

interface EditableTextProps {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
  isSaving?: boolean;
  className?: string;
  inputClassName?: string;
  as?: "h1" | "p" | "span";
}

function EditableText({
  value,
  placeholder = "Click to edit...",
  onSave,
  isSaving,
  className,
  inputClassName,
  as: Component = "span",
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize to fit content
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Save on Enter (without shift for new line)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  if (isEditing) {
    return (
      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Auto-resize on input
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 bg-transparent border-b-2 border-primary outline-none resize-none overflow-hidden",
            inputClassName
          )}
          disabled={isSaving}
          rows={1}
        />
        {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />}
      </div>
    );
  }

  return (
    <Component
      onClick={() => setIsEditing(true)}
      className={cn(
        "group/editable cursor-pointer inline-flex items-center gap-2 rounded-md transition-colors",
        "hover:bg-muted/50 -mx-2 px-2 py-0.5",
        !value && "text-muted-foreground italic",
        className
      )}
    >
      {value || placeholder}
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/editable:opacity-100 transition-opacity shrink-0" />
    </Component>
  );
}

interface EditableTextareaProps {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
  isSaving?: boolean;
  className?: string;
}

function EditableTextarea({
  value,
  placeholder = "Click to add a description...",
  onSave,
  isSaving,
  className,
}: EditableTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave, handleCancel]
  );

  if (isEditing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Description
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full bg-transparent border rounded-md border-primary px-3 py-2 outline-none resize-none min-h-[80px]",
              className
            )}
            disabled={isSaving}
            placeholder={placeholder}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span>⌘+Enter to save · Esc to cancel</span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      onClick={() => setIsEditing(true)}
      className="group/editable cursor-pointer transition-colors hover:bg-muted/30 relative"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Description
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-muted-foreground", !value && "italic")}>{value || placeholder}</p>
      </CardContent>
      <Pencil className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover/editable:opacity-100 transition-opacity" />
    </Card>
  );
}

interface InlineTagsEditorProps {
  tags: string[];
  onSave: (tags: string[]) => void;
  isSaving?: boolean;
}

function InlineTagsEditor({ tags, onSave, isSaving }: InlineTagsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTags, setEditTags] = useState<string[]>(tags);
  const [tagInput, setTagInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTags(tags);
  }, [tags]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }, [tagInput, editTags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setEditTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleSave = useCallback(() => {
    // Include any pending tag input
    const finalTags = tagInput.trim() ? [...editTags, tagInput.trim().toLowerCase()] : editTags;
    const uniqueTags = [...new Set(finalTags)];

    if (JSON.stringify(uniqueTags) !== JSON.stringify(tags)) {
      onSave(uniqueTags);
    }
    setTagInput("");
    setIsEditing(false);
  }, [editTags, tagInput, tags, onSave]);

  const handleCancel = useCallback(() => {
    setEditTags(tags);
    setTagInput("");
    setIsEditing(false);
  }, [tags]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" || e.key === "Enter") {
        if (tagInput.trim()) {
          e.preventDefault();
          handleAddTag();
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleSave();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Backspace" && !tagInput && editTags.length > 0) {
        setEditTags((prev) => prev.slice(0, -1));
      }
    },
    [tagInput, editTags.length, handleAddTag, handleSave, handleCancel]
  );

  if (isEditing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-primary bg-background px-3 py-2 min-h-[42px]">
            {editTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-xs">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={editTags.length === 0 ? "Type a tag..." : ""}
              className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={isSaving}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Done
            </Button>
            <span className="text-xs text-muted-foreground">Tab to add · Enter to save</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      onClick={() => setIsEditing(true)}
      className="group/editable cursor-pointer transition-colors hover:bg-muted/30 relative"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">No tags</span>
        )}
      </CardContent>
      <Pencil className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover/editable:opacity-100 transition-opacity" />
    </Card>
  );
}

interface InlineCollectionsEditorProps {
  selectedIds: string[];
  allCollections: Array<{ id: string; name: string }>;
  onSave: (collectionIds: string[]) => void;
  onCreateCollection: (name: string) => void;
  isSaving?: boolean;
  isCreating?: boolean;
}

function InlineCollectionsEditor({
  selectedIds,
  allCollections,
  onSave,
  onCreateCollection,
  isSaving,
  isCreating,
}: InlineCollectionsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editIds, setEditIds] = useState<string[]>(selectedIds);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditIds(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    if (isCreatingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingNew]);

  const handleToggle = useCallback((id: string) => {
    setEditIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const handleSave = useCallback(() => {
    if (JSON.stringify(editIds.sort()) !== JSON.stringify(selectedIds.sort())) {
      onSave(editIds);
    }
    setIsEditing(false);
  }, [editIds, selectedIds, onSave]);

  const handleCancel = useCallback(() => {
    setEditIds(selectedIds);
    setIsEditing(false);
    setIsCreatingNew(false);
    setNewName("");
  }, [selectedIds]);

  const handleCreateNew = useCallback(() => {
    const trimmed = newName.trim();
    if (trimmed) {
      onCreateCollection(trimmed);
      setNewName("");
      setIsCreatingNew(false);
    }
  }, [newName, onCreateCollection]);

  const handleNewKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreateNew();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsCreatingNew(false);
        setNewName("");
      }
    },
    [handleCreateNew]
  );

  const selectedCollections = allCollections.filter((c) => selectedIds.includes(c.id));

  if (isEditing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            Collections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {allCollections.map((col) => {
              const isSelected = editIds.includes(col.id);
              return (
                <Badge
                  key={col.id}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  onClick={() => handleToggle(col.id)}
                >
                  {col.name}
                </Badge>
              );
            })}
            {isCreatingNew ? (
              <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleNewKeyDown}
                  onBlur={() => {
                    if (!newName.trim()) {
                      setIsCreatingNew(false);
                    }
                  }}
                  placeholder="Name..."
                  className="w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  disabled={isCreating}
                />
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewName("");
                    }}
                    className="rounded p-0.5 hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            ) : (
              <Badge
                variant="outline"
                className="cursor-pointer gap-1 border-dashed hover:bg-muted transition-colors"
                onClick={() => setIsCreatingNew(true)}
              >
                <Plus className="h-3 w-3" />
                New
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Done
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      onClick={() => setIsEditing(true)}
      className="group/editable cursor-pointer transition-colors hover:bg-muted/30 relative"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          Collections
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedCollections.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedCollections.map((col) => (
              <Badge key={col.id} variant="secondary">
                {col.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">No collections</span>
        )}
      </CardContent>
      <Pencil className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover/editable:opacity-100 transition-opacity" />
    </Card>
  );
}

// ============================================================================
// Mobile Edit Tip Component
// ============================================================================

const MOBILE_TIP_STORAGE_KEY = "backpocket-mobile-edit-tip-dismissed";

function MobileEditTip() {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to avoid flash
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Use matchMedia for reliable mobile detection (works with viewport changes)
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    // Check initial value
    handleChange(mediaQuery);
    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    // Check localStorage after mount
    const dismissed = localStorage.getItem(MOBILE_TIP_STORAGE_KEY);
    const shouldShow = dismissed !== "true";
    setIsDismissed(!shouldShow);
    // Delay showing for smooth animation
    if (shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    // Delay actual dismissal for exit animation
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem(MOBILE_TIP_STORAGE_KEY, "true");
    }, 200);
  }, []);

  // Only show on mobile and if not dismissed
  if (!isMobile || isDismissed) return null;

  return (
    <div
      className={cn(
        "fixed top-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-background/95 backdrop-blur-sm border shadow-lg px-4 py-3 text-sm transition-all duration-200",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      )}
    >
      <Hand className="h-5 w-5 text-primary shrink-0" />
      <p className="flex-1 text-muted-foreground">
        <span className="font-medium text-foreground">Tip:</span> Tap any card to edit it
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="rounded-full p-1.5 hover:bg-muted transition-colors"
        aria-label="Dismiss tip"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

const IS_DEV = process.env.NODE_ENV === "development";

export default function SaveDetailPage({ params }: { params: Promise<{ saveId: string }> }) {
  const { saveId } = use(params);
  const router = useRouter();
  const { data: save, isLoading } = trpc.space.getSave.useQuery({ saveId });
  const utils = trpc.useUtils();

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch collections for inline editing
  const { data: allCollections } = trpc.space.listCollections.useQuery();

  const createCollection = trpc.space.createCollection.useMutation({
    onSuccess: () => {
      utils.space.listCollections.invalidate();
    },
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
    },
  });

  // Inline update handlers
  const handleUpdateTitle = useCallback(
    (title: string) => {
      updateSave.mutate({ id: saveId, title: title || undefined });
    },
    [saveId, updateSave]
  );

  const handleUpdateDescription = useCallback(
    (description: string) => {
      updateSave.mutate({ id: saveId, description: description || undefined });
    },
    [saveId, updateSave]
  );

  const handleUpdateVisibility = useCallback(
    (visibility: "private" | "public") => {
      updateSave.mutate({ id: saveId, visibility });
    },
    [saveId, updateSave]
  );

  const handleUpdateTags = useCallback(
    (tags: string[]) => {
      updateSave.mutate({ id: saveId, tagNames: tags });
    },
    [saveId, updateSave]
  );

  const handleUpdateCollections = useCallback(
    (collectionIds: string[]) => {
      updateSave.mutate({ id: saveId, collectionIds });
    },
    [saveId, updateSave]
  );

  const handleCreateCollection = useCallback(
    (name: string) => {
      createCollection.mutate({ name });
    },
    [createCollection]
  );

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

        {/* Dev-only: Dev tools at top for easy access */}
        {IS_DEV && (
          <Card className="mb-6 border-dashed border-yellow-500/50 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-600">
                <Zap className="h-4 w-4" />
                Dev Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
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
                    Trigger Snapshot
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem(MOBILE_TIP_STORAGE_KEY);
                  window.location.reload();
                }}
                className="border-yellow-500/50 hover:bg-yellow-500/10"
              >
                <Hand className="mr-2 h-4 w-4" />
                Reset Mobile Tip
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

        {/* Mobile edit tip - only shows on first visit on mobile */}
        <MobileEditTip />

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

        {/* Title - Inline Editable */}
        <EditableText
          value={save.title || ""}
          placeholder={save.url}
          onSave={handleUpdateTitle}
          isSaving={updateSave.isPending}
          className="text-2xl font-semibold tracking-tight mb-2"
          inputClassName="text-2xl font-semibold tracking-tight"
          as="h1"
        />

        {/* Meta row: source, date, and visibility */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-4">
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
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(save.savedAt)}
          </span>
          <span className="hidden sm:inline">•</span>
          {/* Visibility - Inline Editable via click */}
          <button
            type="button"
            onClick={() =>
              handleUpdateVisibility(save.visibility === "public" ? "private" : "public")
            }
            className="group/visibility inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 transition-colors hover:bg-muted/50"
            disabled={updateSave.isPending}
          >
            <Badge variant="secondary" className={cn("gap-1", visibility.color)}>
              <visibility.icon className="h-3 w-3" />
              {visibility.label}
            </Badge>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/visibility:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Action toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFavorite.mutate({ saveId: save.id })}
            className={cn("gap-2", save.isFavorite && "text-yellow-500")}
          >
            <Star className={cn("h-4 w-4", save.isFavorite && "fill-current")} />
            <span className="hidden sm:inline">{save.isFavorite ? "Unfavorite" : "Favorite"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleArchive.mutate({ saveId: save.id })}
            className={cn("gap-2", save.isArchived && "text-primary")}
          >
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">{save.isArchived ? "Unarchive" : "Archive"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>

        {/* Description - Inline Editable */}
        <div className="mb-6">
          <EditableTextarea
            value={save.description || ""}
            placeholder="Click to add a description..."
            onSave={handleUpdateDescription}
            isSaving={updateSave.isPending}
          />
        </div>

        {/* Metadata - Inline Editable */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tags */}
          <InlineTagsEditor
            tags={save.tags?.map((t) => t.name) || []}
            onSave={handleUpdateTags}
            isSaving={updateSave.isPending}
          />

          {/* Collections */}
          <InlineCollectionsEditor
            selectedIds={save.collections?.map((c) => c.id) || []}
            allCollections={allCollections || []}
            onSave={handleUpdateCollections}
            onCreateCollection={handleCreateCollection}
            isSaving={updateSave.isPending}
            isCreating={createCollection.isPending}
          />
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

        {/* Scroll navigation with progress and section markers */}
        <ScrollNavigator contentSelector="article" />
      </div>
    </div>
  );
}
