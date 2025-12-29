"use client";

import { ArrowUpRight, Eye, EyeOff, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { trpc } from "@/lib/trpc/client";
import type { PublicLayout, SpaceVisibility } from "@/lib/types";

export default function SettingsPage() {
  const { data: space, isLoading } = trpc.space.getMySpace.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>("private");
  const [publicLayout, setPublicLayout] = useState<PublicLayout>("grid");

  useEffect(() => {
    if (space) {
      setName(space.name || "");
      setBio(space.bio || "");
      setVisibility(space.visibility);
      setPublicLayout(space.publicLayout);
    }
  }, [space]);

  const updateSettings = trpc.space.updateSettings.useMutation({
    onSuccess: () => {
      utils.space.getMySpace.invalidate();
    },
  });

  const handleSave = () => {
    updateSettings.mutate({
      name,
      bio,
      visibility,
      publicLayout,
    });
  };

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

              <div className="space-y-2">
                <Label>Avatar</Label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
                    {space?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Avatar is synced from your account
                  </p>
                </div>
              </div>
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
                      ? `Your space is visible at ${space?.slug || "your"}.backpocket.my`
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
                        <p className="text-xs text-muted-foreground">{space?.slug}.backpocket.my</p>
                      </div>
                      <a
                        href={`http://${space?.slug}.localhost:3000`}
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

          {/* Custom Domain (placeholder) */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Domain</CardTitle>
              <CardDescription>Use your own domain for your public space</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed p-6 text-center">
                <Globe className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Custom domains are a Premium feature
                </p>
                <Button variant="outline" size="sm" className="mt-4" disabled>
                  Upgrade to Premium
                </Button>
              </div>
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
