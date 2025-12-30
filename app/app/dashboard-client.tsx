"use client";

import { useUser } from "@clerk/nextjs";
import { ArrowUpRight, Bookmark, Eye, FolderOpen, Globe, Plus, Star, Tags } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IS_DEVELOPMENT, ROOT_DOMAIN } from "@/lib/config/public";
import { routes, savesWithFilter } from "@/lib/constants/routes";
import { buildSpaceHostname, buildSpaceUrl } from "@/lib/constants/urls";
import { trpc } from "@/lib/trpc/client";
import { formatNumber } from "@/lib/utils";

function StatCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  href?: string;
}) {
  const content = (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function StatsSkeleton() {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentSavesSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 rounded-lg p-2">
          <Skeleton className="h-12 w-16 shrink-0 rounded-md" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardClient() {
  const { user, isLoaded: userLoaded } = useUser();

  // Single query that fetches all dashboard data at once
  const { data: dashboardData, isLoading } = trpc.space.getDashboardData.useQuery();

  const stats = dashboardData?.stats;
  const space = dashboardData?.space;
  const recentSaves = dashboardData?.recentSaves;
  const firstName = user?.firstName;

  return (
    <div className="p-6 lg:p-8">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight h-8 flex items-center">
          {!userLoaded ? (
            <>
              Welcome back
              <Skeleton className="ml-2 h-6 w-24 inline-block" />
            </>
          ) : (
            <>Welcome back{firstName ? `, ${firstName}` : ""}</>
          )}
        </h1>
        <p className="text-muted-foreground">Here's an overview of your collection</p>
      </div>

      {/* Stats grid */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Saves"
            value={formatNumber(stats?.totalSaves ?? 0)}
            icon={Bookmark}
            href={routes.app.saves}
          />
          <StatCard
            title="Public Saves"
            value={formatNumber(stats?.publicSaves ?? 0)}
            icon={Globe}
            href={savesWithFilter("public")}
          />
          <StatCard
            title="Favorites"
            value={formatNumber(stats?.favorites ?? 0)}
            icon={Star}
            href={savesWithFilter("favorites")}
          />
          <StatCard title="Visitors" value={formatNumber(stats?.visitCount ?? 0)} icon={Eye} />
        </div>
      )}

      {/* Quick actions + Recent saves */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Quick actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href={routes.app.savesNew}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                Add a new save
              </Button>
            </Link>
            <Link href={routes.app.collections}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FolderOpen className="h-4 w-4" />
                Manage collections
              </Button>
            </Link>
            <Link href={routes.app.tags}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Tags className="h-4 w-4" />
                Manage tags
              </Button>
            </Link>
            <Link href={routes.app.settings}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Globe className="h-4 w-4" />
                Public space settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent saves */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Saves</CardTitle>
            <Link href={routes.app.saves}>
              <Button variant="ghost" size="sm">
                View all
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <RecentSavesSkeleton />
            ) : recentSaves && recentSaves.length > 0 ? (
              <div className="space-y-4">
                {recentSaves.map((save) => (
                  <Link
                    key={save.id}
                    href={routes.app.save(save.id)}
                    className="flex items-start gap-4 rounded-lg p-2 transition-colors hover:bg-accent"
                  >
                    {save.imageUrl ? (
                      <div className="relative h-12 w-16 shrink-0">
                        <Image
                          src={save.imageUrl}
                          alt=""
                          fill
                          className="rounded-md object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-md bg-muted">
                        <Bookmark className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{save.title || save.url}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {save.siteName || new URL(save.url).hostname}
                      </p>
                    </div>
                    {save.isFavorite && (
                      <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No saves yet. Add your first link!</p>
                <Link href={routes.app.savesNew} className="mt-4 inline-block">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Save
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Public space preview */}
      {space?.visibility === "public" && (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Your Public Space</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {buildSpaceHostname({
                  slug: space.slug,
                  rootDomain: ROOT_DOMAIN,
                  isLocalhost: IS_DEVELOPMENT,
                })}
              </p>
            </div>
            <a
              href={buildSpaceUrl({
                slug: space.slug,
                rootDomain: ROOT_DOMAIN,
                isLocalhost: IS_DEVELOPMENT,
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                Visit
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </a>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span>
                  <strong>{formatNumber(stats?.visitCount ?? 0)}</strong> visits
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>
                  <strong>{formatNumber(stats?.publicSaves ?? 0)}</strong> public saves
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
