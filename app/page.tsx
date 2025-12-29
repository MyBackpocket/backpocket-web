export const dynamic = "force-dynamic";

import {
  ArrowRight,
  Bookmark,
  Check,
  Eye,
  FolderOpen,
  Globe,
  Lock,
  Rss,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@/components/auth-components";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { TypewriterUrl } from "@/components/typewriter-url";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started with personal bookmarking",
    features: [
      "Unlimited private saves",
      "Up to 100 public saves",
      "Subdomain (you.backpocket.my)",
      "Basic themes",
      "Up to 5 collections",
      "Browser extension",
      "Email saving",
      "RSS feed",
    ],
    cta: "Get Started",
    ctaLink: "/sign-up",
    popular: false,
  },
  {
    name: "Premium",
    price: "$6",
    period: "/month",
    yearlyPrice: "$60/year",
    description: "For serious curators who want to share more",
    features: [
      "Everything in Free, plus:",
      "Unlimited public saves",
      "Custom domains",
      "All themes + custom CSS",
      "Unlimited collections",
      "Advanced search filters",
      "API access",
      "Remove 'Powered by' footer",
      "Priority support",
    ],
    cta: "Start Free Trial",
    ctaLink: "/sign-up",
    popular: true,
  },
  {
    name: "Business",
    price: "$15",
    period: "/month",
    description: "For teams and organizations (coming soon)",
    features: [
      "Everything in Premium, plus:",
      "Team spaces with roles",
      "Admin controls",
      "Higher API limits",
      "SSO / SCIM (WorkOS)",
      "Audit logs",
      "Dedicated support",
    ],
    cta: "Coming Soon",
    ctaLink: "#",
    popular: false,
    disabled: true,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-denim">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="md" />
          </Link>

          <div className="flex items-center gap-4">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </a>
            <ThemeSwitcher />
            <SignedOut>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Get Started</Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/app">
                <Button size="sm">
                  Open App
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
        {/* Background decoration - playful colored blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 h-72 w-72 rounded-full bg-denim/10 blur-3xl" />
          <div className="absolute bottom-40 right-1/4 h-96 w-96 rounded-full bg-rust/10 blur-3xl" />
          <div className="absolute top-60 right-1/3 h-48 w-48 rounded-full bg-mint/10 blur-3xl" />
          <div className="absolute bottom-20 left-1/3 h-64 w-64 rounded-full bg-amber/8 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="stagger-children mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-denim/20 bg-background/60 px-4 py-1.5 text-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-amber" />
              <span>No social features. Just your content.</span>
            </div>

            <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Your collection,
              <br />
              <span className="text-rust">beautifully shared</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Save articles, videos, and links into your personal library. Optionally publish a
              read-only collection at your own URL — no followers, no likes, just your curated
              finds.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <SignedOut>
                <Link href="/sign-up">
                  <Button size="lg" className="h-12 px-8 text-base">
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                    Learn more
                  </Button>
                </a>
              </SignedOut>
              <SignedIn>
                <Link href="/app">
                  <Button size="lg" className="h-12 px-8 text-base">
                    Open your library
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </SignedIn>
            </div>

            {/* Example URL - styled like a denim patch */}
            <TypewriterUrl />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A calm, focused space for your reading and curation.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-2xl border bg-card p-8 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rust/10 text-rust transition-colors group-hover:bg-rust group-hover:text-white">
                <Bookmark className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Save anything</h3>
              <p className="text-muted-foreground">
                Articles, videos, PDFs, images, threads — save any URL worth keeping. We&apos;ll
                preserve it for you.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl border bg-card p-8 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mint/15 text-mint transition-colors group-hover:bg-mint group-hover:text-white">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Stay organized</h3>
              <p className="text-muted-foreground">
                Collections, tags, favorites, and archive. Find what you need with powerful search
                and filters.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-2xl border bg-card p-8 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-denim/12 text-denim transition-colors group-hover:bg-denim group-hover:text-white">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Share via URL</h3>
              <p className="text-muted-foreground">
                Publish your collection at your own subdomain or custom domain. People find you via
                the link you share.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-2xl border bg-card p-8 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber/15 text-amber transition-colors group-hover:bg-amber group-hover:text-white">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Privacy by default</h3>
              <p className="text-muted-foreground">
                Everything starts private. You choose what to share. Notes and annotations are
                always yours alone.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-2xl border bg-card p-8 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal/15 text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                <Eye className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">One honest metric</h3>
              <p className="text-muted-foreground">
                A simple visitor counter shows total visits. No tracking, no cookies, no analytics —
                just a count.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group rounded-2xl border bg-card p-8 shadow-denim transition-all hover:shadow-denim-lg hover:-translate-y-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-denim-faded/20 text-denim-deep transition-colors group-hover:bg-denim-deep group-hover:text-white">
                <Rss className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">RSS included</h3>
              <p className="text-muted-foreground">
                Your public saves get an RSS feed automatically. Let people follow your finds in
                their favorite reader.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* No Social Section - with stitching detail */}
      <section className="relative border-y border-denim/20 bg-card/50 py-20 md:py-32">
        {/* Decorative stitching lines */}
        <div className="absolute inset-x-0 top-4 border-t-2 border-dashed border-rust/20" />
        <div className="absolute inset-x-0 bottom-4 border-b-2 border-dashed border-rust/20" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
              Intentionally non-social
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              We believe in organic sharing. There are no followers, likes, comments, or discovery
              feeds. No user directory or algorithmic recommendations. People find your space via
              the URL you share — in your bio, email signature, or conversation.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {[
                { label: "No followers", color: "tag-denim" },
                { label: "No likes", color: "tag-rust" },
                { label: "No comments", color: "tag-mint" },
                { label: "No feed", color: "tag-teal" },
                { label: "No algorithms", color: "tag-amber" },
                { label: "No tracking", color: "tag-denim" },
              ].map((item) => (
                <span
                  key={item.label}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${item.color}`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
              Simple, honest pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Upgrade when you need more.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-card p-8 shadow-denim transition-all ${
                  plan.popular
                    ? "border-rust shadow-denim-lg ring-2 ring-rust/30 md:scale-[1.02]"
                    : "border-denim/20 hover:shadow-denim-lg hover:-translate-y-1"
                } ${plan.disabled ? "opacity-60" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rust px-4 py-1 text-xs font-medium text-white flex items-center gap-1.5">
                    <Star className="h-3 w-3 fill-current" />
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  {plan.yearlyPrice && (
                    <p className="mt-1 text-sm text-mint font-medium">
                      or {plan.yearlyPrice} (save 17%)
                    </p>
                  )}
                  <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check
                        className={`mt-0.5 h-5 w-5 shrink-0 ${
                          plan.popular ? "text-rust" : "text-mint"
                        }`}
                      />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.disabled ? "#" : plan.ctaLink}>
                  <Button
                    className={`w-full ${
                      plan.popular ? "bg-rust hover:bg-rust/90 text-white" : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    disabled={plan.disabled}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-sm text-muted-foreground">
            All plans include a 14-day free trial. No credit card required to start. Export your
            data anytime.
          </p>
        </div>
      </section>

      {/* CTA Section - Denim pocket inspired */}
      <section className="py-20 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-denim to-denim-deep px-8 py-16 text-center text-white md:px-16 md:py-24">
            {/* Stitching detail */}
            <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-rust/40 pointer-events-none" />

            {/* Background pattern */}
            <div className="absolute inset-0 -z-10 opacity-10">
              <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
              <div className="absolute bottom-0 right-0 h-full w-full bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.15)_0%,transparent_50%)]" />
            </div>

            <h2 className="font-serif text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl">
              Start building your collection
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg opacity-90">
              Free to start. Save unlimited private links. Up to 100 public saves on your own
              subdomain.
            </p>
            <div className="mt-10">
              <SignedOut>
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base bg-rust hover:bg-rust/90 text-white"
                  >
                    Create your space
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/app">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base bg-rust hover:bg-rust/90 text-white"
                  >
                    Open your library
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-denim/20 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <Logo size="md" />
            </Link>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                Pricing
              </a>
            </div>

            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} backpocket</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
