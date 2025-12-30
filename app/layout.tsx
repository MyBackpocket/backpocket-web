import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { ClerkProvider } from "@/components/clerk-provider";
import { Providers } from "@/components/providers";
import { WebVitals } from "@/components/web-vitals";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "backpocket — Your collection, beautifully shared",
  description:
    "Save content for yourself, organize it into a personal library, and optionally publish a read-only collection at your own URL.",
  keywords: ["bookmarking", "reading list", "content curation", "personal library"],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "backpocket — Your collection, beautifully shared",
    description:
      "Save content for yourself, organize it into a personal library, and optionally publish a read-only collection at your own URL.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased`}>
          <WebVitals />
          <SpeedInsights />
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
