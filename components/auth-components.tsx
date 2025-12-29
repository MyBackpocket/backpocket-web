"use client";

import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  UserButton as ClerkUserButton,
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
