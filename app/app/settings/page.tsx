"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Link as LinkIcon,
  Loader2,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { AccountInfo } from "@/components/auth-components";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ROOT_DOMAIN } from "@/lib/config/public";
import { dnsProviderList, vercelDns } from "@/lib/constants/dns";
import { buildSpaceUrl, isLocalhostHostname } from "@/lib/constants/urls";
import { trpc } from "@/lib/trpc/client";
import type { PublicLayout, SpaceVisibility } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export default function SettingsPage() {
  const { data: space, isLoading } = trpc.space.getMySpace.useQuery();
  const { data: domains, refetch: refetchDomains } = trpc.space.listDomains.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>("private");
  const [publicLayout, setPublicLayout] = useState<PublicLayout>("grid");

  // Slug editing state
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Domain adding state
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    if (space) {
      setName(space.name || "");
      setBio(space.bio || "");
      setVisibility(space.visibility);
      setPublicLayout(space.publicLayout);
      setSlug(space.slug);
      setSlugInput(space.slug);
    }
  }, [space]);

  const updateSettings = trpc.space.updateSettings.useMutation({
    onSuccess: () => {
      utils.space.getMySpace.invalidate();
    },
  });

  const updateSlug = trpc.space.updateSlug.useMutation({
    onSuccess: () => {
      utils.space.getMySpace.invalidate();
      setIsEditingSlug(false);
      setSlugError(null);
    },
    onError: (error) => {
      setSlugError(error.message);
    },
  });

  const addDomain = trpc.space.addDomain.useMutation({
    onSuccess: () => {
      refetchDomains();
      setIsAddingDomain(false);
      setNewDomain("");
      setDomainError(null);
    },
    onError: (error) => {
      setDomainError(error.message);
    },
  });

  const verifyDomain = trpc.space.verifyDomain.useMutation({
    onSuccess: () => {
      refetchDomains();
    },
  });

  const removeDomain = trpc.space.removeDomain.useMutation({
    onSuccess: () => {
      refetchDomains();
    },
  });

  // Debounced slug availability check
  const { data: slugAvailability, isFetching: isCheckingSlug } =
    trpc.space.checkSlugAvailability.useQuery(
      { slug: slugInput },
      {
        enabled: isEditingSlug && slugInput.length >= 3 && slugInput !== slug,
        staleTime: 1000,
      }
    );

  const handleSave = () => {
    updateSettings.mutate({
      name,
      bio,
      visibility,
      publicLayout,
    });
  };

  const handleSlugChange = useCallback((value: string) => {
    // Normalize: lowercase, remove invalid chars
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlugInput(normalized);
    setSlugError(null);
  }, []);

  const handleSlugSave = () => {
    if (slugInput === slug) {
      setIsEditingSlug(false);
      return;
    }
    updateSlug.mutate({ slug: slugInput });
  };

  const handleSlugCancel = () => {
    setSlugInput(slug);
    setIsEditingSlug(false);
    setSlugError(null);
  };

  const handleAddDomain = () => {
    if (!newDomain) return;
    setDomainError(null);
    addDomain.mutate({ domain: newDomain });
  };

  // Get slug status message
  const getSlugStatus = () => {
    if (slugInput === slug) {
      return null;
    }
    if (slugInput.length < 3) {
      return { type: "error", message: "At least 3 characters required" };
    }
    if (isCheckingSlug) {
      return { type: "loading", message: "Checking availability..." };
    }
    if (slugAvailability) {
      if (slugAvailability.available) {
        return { type: "success", message: "Available!" };
      }
      switch (slugAvailability.reason) {
        case "reserved":
          return { type: "error", message: "This subdomain is reserved" };
        case "taken":
          return { type: "error", message: "Already taken" };
        case "invalid_format":
          return { type: "error", message: "Invalid format" };
        default:
          return { type: "error", message: "Not available" };
      }
    }
    return null;
  };

  const slugStatus = getSlugStatus();

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48 mb-8" />
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your space and public profile</p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>This information appears on your public space</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="Your name or title"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="A short description of your collection"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed on your public space header
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <AccountCard />

          {/* Subdomain Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Subdomain
              </CardTitle>
              <CardDescription>Your public space URL on {ROOT_DOMAIN}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingSlug ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Subdomain</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="slug"
                          value={slugInput}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          placeholder="your-name"
                          className="pr-10"
                        />
                        {slugStatus && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {slugStatus.type === "loading" && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            {slugStatus.type === "success" && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                            {slugStatus.type === "error" && (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        .{ROOT_DOMAIN}
                      </span>
                    </div>
                    {slugStatus && (
                      <p
                        className={`text-xs ${
                          slugStatus.type === "success"
                            ? "text-green-600"
                            : slugStatus.type === "error"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {slugStatus.message}
                      </p>
                    )}
                    {slugError && <p className="text-xs text-destructive">{slugError}</p>}
                    <p className="text-xs text-muted-foreground">
                      3-32 characters, lowercase letters, numbers, and hyphens only
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSlugSave}
                      disabled={
                        updateSlug.isPending ||
                        slugInput === slug ||
                        slugStatus?.type === "error" ||
                        slugStatus?.type === "loading"
                      }
                    >
                      {updateSlug.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSlugCancel}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {slug}.{ROOT_DOMAIN}
                    </p>
                    <p className="text-xs text-muted-foreground">This is your public space URL</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsEditingSlug(true)}>
                    Change
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Space Visibility */}
          <Card>
            <CardHeader>
              <CardTitle>Public Space</CardTitle>
              <CardDescription>Control whether your space is visible to the public</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Space Visibility</Label>
                  <p className="text-sm text-muted-foreground">
                    {visibility === "public"
                      ? `Your space is visible at ${slug}.${ROOT_DOMAIN}`
                      : "Your space is private and not accessible publicly"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {visibility === "public" ? (
                    <Eye className="h-5 w-5 text-green-600" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <Switch
                    checked={visibility === "public"}
                    onCheckedChange={(checked) => setVisibility(checked ? "public" : "private")}
                  />
                </div>
              </div>

              {visibility === "public" && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="layout">Default Layout</Label>
                    <Select
                      value={publicLayout}
                      onValueChange={(v) => setPublicLayout(v as PublicLayout)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid — Card-based visual layout</SelectItem>
                        <SelectItem value="list">List — Compact text-based layout</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      How saves are displayed on your public space
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Preview your space</p>
                        <p className="text-xs text-muted-foreground">
                          {slug}.{ROOT_DOMAIN}
                        </p>
                      </div>
                      <a
                        href={buildSpaceUrl({
                          slug,
                          rootDomain: ROOT_DOMAIN,
                          isLocalhost:
                            typeof window !== "undefined" &&
                            isLocalhostHostname(window.location.hostname),
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          Visit
                          <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Custom Domain */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Custom Domain
              </CardTitle>
              <CardDescription>Use your own domain for your public space</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing domains */}
              {domains && domains.length > 0 && (
                <div className="space-y-3">
                  {domains.map((domain) => (
                    <DomainItem
                      key={domain.id}
                      domain={domain}
                      onVerify={() => verifyDomain.mutate({ domainId: domain.id })}
                      onRemove={() => removeDomain.mutate({ domainId: domain.id })}
                      isVerifying={verifyDomain.isPending}
                      isRemoving={removeDomain.isPending}
                    />
                  ))}
                </div>
              )}

              {/* Add domain form */}
              {isAddingDomain ? (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="newDomain">Domain</Label>
                    <Input
                      id="newDomain"
                      placeholder="yourdomain.com"
                      value={newDomain}
                      onChange={(e) => {
                        setNewDomain(e.target.value);
                        setDomainError(null);
                      }}
                    />
                    {domainError && <p className="text-xs text-destructive">{domainError}</p>}
                    <p className="text-xs text-muted-foreground">
                      Enter your domain without http:// or https://
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddDomain} disabled={addDomain.isPending}>
                      {addDomain.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Domain
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingDomain(false);
                        setNewDomain("");
                        setDomainError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAddingDomain(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Domain
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Choose your preferred theme. This setting applies across the entire platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSelector />
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Account card component with Clerk integration
function AccountCard() {
  return (
    <AccountInfo
      fallback={
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Account management is not available in development mode.
            </p>
          </CardContent>
        </Card>
      }
    >
      {({ user, isLoaded, openUserProfile }) => {
        if (!isLoaded) {
          return (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }

        if (!user) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account
                </CardTitle>
                <CardDescription>Manage your account settings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Account management is not available.
                </p>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account
              </CardTitle>
              <CardDescription>Manage your account, profile picture, and security</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {user.imageUrl ? (
                    <Image
                      src={user.imageUrl}
                      alt={user.fullName || "Profile"}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full object-cover ring-2 ring-border"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold ring-2 ring-border">
                      {user.firstName?.charAt(0)?.toUpperCase() ||
                        user.emailAddresses?.[0]?.emailAddress?.charAt(0)?.toUpperCase() ||
                        "U"}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {user.fullName || user.emailAddresses?.[0]?.emailAddress || "User"}
                    </p>
                    {user.fullName && user.emailAddresses?.[0]?.emailAddress && (
                      <p className="text-sm text-muted-foreground">
                        {user.emailAddresses[0].emailAddress}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" onClick={() => openUserProfile()}>
                  Manage Account
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      }}
    </AccountInfo>
  );
}

// Theme selector component
function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const themes = [
    { value: "light", label: "Light", icon: Sun, description: "Light background" },
    { value: "dark", label: "Dark", icon: Moon, description: "Dark background" },
    { value: "system", label: "System", icon: Monitor, description: "Match device" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {themes.map(({ value, label, icon: Icon, description }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
            theme === value
              ? "border-denim bg-denim/5"
              : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
          }`}
        >
          <Icon className={`h-6 w-6 ${theme === value ? "text-denim" : "text-muted-foreground"}`} />
          <div className="text-center">
            <p className={`text-sm font-medium ${theme === value ? "text-foreground" : ""}`}>
              {label}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {theme === value && (
            <div className="absolute top-2 right-2">
              <Check className="h-4 w-4 text-denim" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// Domain item component
interface DomainData {
  id: string;
  domain: string;
  status: "pending_verification" | "verified" | "active" | "error" | "disabled";
  spaceId: string;
  verificationToken: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function DomainItem({
  domain,
  onVerify,
  onRemove,
  isVerifying,
  isRemoving,
}: {
  domain: DomainData;
  onVerify: () => void;
  onRemove: () => void;
  isVerifying: boolean;
  isRemoving: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { data: status, refetch } = trpc.space.getDomainStatus.useQuery(
    { domainId: domain.id },
    { refetchInterval: domain.status === "pending_verification" ? 10000 : false }
  );

  const isActive = status?.status === "active" || status?.verified;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{domain.domain}</p>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="h-3 w-3" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Pending
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </a>
          )}
          {!isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetch();
                onVerify();
              }}
              disabled={isVerifying}
              className="h-8 w-8 p-0"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isRemoving}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove custom domain?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{domain.domain}</strong>? You'll need to
              reconfigure your DNS settings if you want to add it again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onRemove();
                setShowDeleteConfirm(false);
              }}
              disabled={isRemoving}
            >
              {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DNS Configuration instructions */}
      {!isActive && status?.verification && status.verification.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Add these DNS records at your domain registrar or DNS provider:
          </p>

          {/* Step 1: Verification TXT record */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Step 1: Add verification record
            </p>
            <div className="space-y-3 rounded-md bg-muted/50 p-3 text-sm">
              {status.verification.map((v, i) => (
                <div key={i} className="space-y-2">
                  <div className="grid grid-cols-[70px,1fr] gap-2 items-center">
                    <span className="text-xs text-muted-foreground">Type:</span>
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded w-fit">
                      {v.type}
                    </span>
                  </div>
                  <div className="grid grid-cols-[70px,1fr,auto] gap-2 items-center">
                    <span className="text-xs text-muted-foreground">Name:</span>
                    <code className="font-mono text-xs truncate">{v.domain}</code>
                    <CopyButton text={v.domain} />
                  </div>
                  <div className="grid grid-cols-[70px,1fr,auto] gap-2 items-center">
                    <span className="text-xs text-muted-foreground">Value:</span>
                    <code className="font-mono text-xs truncate">{v.value}</code>
                    <CopyButton text={v.value} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Point domain to backpocket */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Step 2: Point your domain to backpocket
            </p>
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 space-y-2">
              <div className="space-y-1">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <strong>For subdomains</strong> (e.g., backpocket.yourdomain.com):
                </p>
                <div className="flex items-center gap-2 bg-blue-100/50 dark:bg-blue-800/30 rounded px-2 py-1">
                  <span className="font-mono text-xs">CNAME →</span>
                  <code className="font-mono text-xs flex-1">{vercelDns.cname}</code>
                  <CopyButton text={vercelDns.cname} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <strong>For apex/root domains</strong> (e.g., yourdomain.com):
                </p>
                <div className="flex items-center gap-2 bg-blue-100/50 dark:bg-blue-800/30 rounded px-2 py-1">
                  <span className="font-mono text-xs">A →</span>
                  <code className="font-mono text-xs flex-1">{vercelDns.aRecord}</code>
                  <CopyButton text={vercelDns.aRecord} />
                </div>
              </div>
            </div>
          </div>

          {/* DNS Provider help */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Need help? DNS guides for popular providers
            </summary>
            <div className="mt-2 space-y-1 pl-3 text-muted-foreground">
              <p>
                {dnsProviderList.map((provider, index) => (
                  <span key={provider.name}>
                    {index > 0 && " · "}
                    <a
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {provider.name}
                    </a>
                  </span>
                ))}
              </p>
              <p className="text-muted-foreground/70">
                DNS changes can take up to 48 hours to propagate, but usually complete within
                minutes.
              </p>
            </div>
          </details>
        </div>
      )}

      {/* Misconfigured warning */}
      {status?.misconfigured && (
        <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="inline h-3 w-3 mr-1" />
            DNS is misconfigured. Please check your DNS settings.
          </p>
        </div>
      )}
    </div>
  );
}
