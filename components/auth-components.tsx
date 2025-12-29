"use client";

import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  UserButton as ClerkUserButton,
  useClerk,
  useUser,
} from "@clerk/nextjs";

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

export function UserButton(props: React.ComponentProps<typeof ClerkUserButton>) {
  if (!hasClerk) {
    // In dev without Clerk, show a placeholder avatar
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
        U
      </div>
    );
  }
  return <ClerkUserButton {...props} />;
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
