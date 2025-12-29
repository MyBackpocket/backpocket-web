export const dynamic = "force-dynamic";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

async function ClerkSignIn() {
  if (!hasClerk) return null;
  const { SignIn } = await import("@clerk/nextjs");
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "shadow-denim-lg border border-denim/20 bg-card rounded-2xl",
          headerTitle: "text-xl font-semibold",
          headerSubtitle: "text-muted-foreground",
          formButtonPrimary: "bg-rust hover:bg-rust/90 text-white",
          footerActionLink: "text-rust hover:text-rust/80",
          socialButtonsBlockButton: "border-denim/20 hover:bg-accent",
        },
      }}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/app"
    />
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-denim px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-20 left-1/4 h-72 w-72 rounded-full bg-denim/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-64 w-64 rounded-full bg-rust/8 blur-3xl" />
      </div>

      <Link href="/" className="mb-8">
        <Logo size="lg" />
      </Link>

      {hasClerk ? (
        <ClerkSignIn />
      ) : (
        <div className="text-center rounded-2xl border border-denim/20 bg-card p-8 shadow-denim-lg">
          <p className="text-muted-foreground mb-4">Clerk authentication is not configured.</p>
          <Link href="/app">
            <Button className="bg-rust hover:bg-rust/90 text-white">
              Continue to App (Dev Mode)
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
