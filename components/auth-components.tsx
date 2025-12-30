"use client";

import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  UserButton as ClerkUserButton,
  useClerk,
  useUser,
} from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Wrapper components that work without Clerk configured
export function SignedIn({ children }: { children: React.ReactNode }) {
  if (!hasClerk) {
    // In dev without Clerk, assume signed in
    return <>{children}</>;
  }
  return <ClerkSignedIn>{children}</ClerkSignedIn>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  if (!hasClerk) {
    // In dev without Clerk, assume signed in (so don't show SignedOut content)
    return null;
  }
  return <ClerkSignedOut>{children}</ClerkSignedOut>;
}

type UserButtonProps = React.ComponentProps<typeof ClerkUserButton> & {
  /** Class name for the wrapper container size (e.g. "h-9 w-9") */
  sizeClassName?: string;
};

// Internal component that handles the loading state for UserButton
function ClerkUserButtonWithSkeleton({ sizeClassName = "h-8 w-8", ...props }: UserButtonProps) {
  const { isLoaded } = useUser();

  // Fixed-size wrapper prevents any layout shift
  return (
    <div className={`${sizeClassName} shrink-0 relative`}>
      {!isLoaded && <Skeleton className="absolute inset-0 rounded-full" />}
      <ClerkUserButton {...props} />
    </div>
  );
}

export function UserButton({ sizeClassName = "h-8 w-8", ...props }: UserButtonProps) {
  if (!hasClerk) {
    // In dev without Clerk, show a placeholder avatar
    return (
      <div
        className={`flex ${sizeClassName} items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0`}
      >
        U
      </div>
    );
  }
  return <ClerkUserButtonWithSkeleton sizeClassName={sizeClassName} {...props} />;
}

// Internal component that uses Clerk hooks (only rendered when Clerk is available)
function ClerkAccountInfo({
  children,
}: {
  children: (props: {
    user: ReturnType<typeof useUser>["user"];
    isLoaded: boolean;
    openUserProfile: () => void;
  }) => React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  return <>{children({ user, isLoaded, openUserProfile })}</>;
}

// Account info component that works with or without Clerk
export function AccountInfo({
  children,
  fallback,
}: {
  children: (props: {
    user: ReturnType<typeof useUser>["user"];
    isLoaded: boolean;
    openUserProfile: () => void;
  }) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!hasClerk) {
    // Return fallback or render children with null user
    if (fallback) return <>{fallback}</>;
    return (
      <>
        {children({
          user: null,
          isLoaded: true,
          openUserProfile: () => console.log("Clerk not configured"),
        })}
      </>
    );
  }
  return <ClerkAccountInfo>{children}</ClerkAccountInfo>;
}
