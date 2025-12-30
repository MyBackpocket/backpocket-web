/**
 * Readability extraction utilities
 *
 * Uses linkedom instead of jsdom for better Next.js serverless compatibility.
 * linkedom is ~50x faster and has proper ESM support.
 */

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { SNAPSHOT_EXCERPT_LENGTH, SNAPSHOT_MAX_TEXT_LENGTH } from "@/lib/constants/snapshots";
import type { SnapshotContent } from "@/lib/types";

export interface ExtractResult {
  ok: true;
  content: SnapshotContent;
}

export interface ExtractError {
  ok: false;
  message: string;
}

export type ReadabilityResult = ExtractResult | ExtractError;

/**
 * Extract readable content from HTML using Mozilla Readability
 */
export function extractReadableContent(html: string, url: string): ReadabilityResult {
  try {
    // Parse HTML with linkedom (faster and better serverless compatibility than jsdom)
    const { document } = parseHTML(html);

    // Set the document URL for relative link resolution
    // linkedom doesn't have a URL option, so we handle it in the content if needed
    Object.defineProperty(document, "baseURI", { value: url, writable: false });

    // Check for noarchive in the parsed DOM (more accurate)
    const metaTags = document.querySelectorAll('meta[name="robots"]');
    for (const meta of metaTags) {
      const content = meta.getAttribute("content") || "";
      if (content.toLowerCase().includes("noarchive")) {
        return { ok: false, message: "Page has noarchive directive" };
      }
    }

    // Create Readability instance and parse
    const reader = new Readability(document, {
      charThreshold: 100,
      keepClasses: false,
    });

    const article = reader.parse();

    if (!article) {
      return { ok: false, message: "Readability could not extract content" };
    }

    // Truncate if too long
    let textContent = article.textContent || "";
    if (textContent.length > SNAPSHOT_MAX_TEXT_LENGTH) {
      textContent = `${textContent.slice(0, SNAPSHOT_MAX_TEXT_LENGTH)}...`;
    }

    // Generate excerpt
    let excerpt = article.excerpt || "";
    if (!excerpt && textContent) {
      excerpt = textContent.slice(0, SNAPSHOT_EXCERPT_LENGTH);
      // Try to cut at word boundary
      const lastSpace = excerpt.lastIndexOf(" ");
      if (lastSpace > SNAPSHOT_EXCERPT_LENGTH * 0.8) {
        excerpt = `${excerpt.slice(0, lastSpace)}...`;
      } else if (textContent.length > SNAPSHOT_EXCERPT_LENGTH) {
        excerpt = `${excerpt}...`;
      }
    }

    // Extract additional metadata
    const ogSiteName = document
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute("content");
    const twitterSite = document
      .querySelector('meta[name="twitter:site"]')
      ?.getAttribute("content");
    const siteName = article.siteName || ogSiteName || twitterSite || null;

    // Detect language
    const htmlLang = document.documentElement.getAttribute("lang");
    const metaLang = document
      .querySelector('meta[http-equiv="content-language"]')
      ?.getAttribute("content");
    const language = htmlLang || metaLang || null;

    const content: SnapshotContent = {
      title: article.title || "",
      byline: article.byline || null,
      content: article.content || "",
      textContent,
      excerpt,
      siteName,
      length: article.length || 0,
      language,
    };

    return { ok: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    return { ok: false, message };
  }
}

/**
 * Extract metadata from HTML without full readability parsing
 * Useful for backfilling save metadata
 */
export function extractMetadata(
  html: string,
  url: string
): {
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  canonicalUrl: string | null;
} {
  try {
    const { document } = parseHTML(html);

    // Title: og:title > twitter:title > title tag
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
    const twitterTitle = document
      .querySelector('meta[name="twitter:title"]')
      ?.getAttribute("content");
    const titleTag = document.querySelector("title")?.textContent;
    const title = ogTitle || twitterTitle || titleTag || null;

    // Description: og:description > twitter:description > meta description
    const ogDesc = document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content");
    const twitterDesc = document
      .querySelector('meta[name="twitter:description"]')
      ?.getAttribute("content");
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content");
    const description = ogDesc || twitterDesc || metaDesc || null;

    // Site name
    const ogSiteName = document
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute("content");
    const twitterSite = document
      .querySelector('meta[name="twitter:site"]')
      ?.getAttribute("content");
    const siteName = ogSiteName || twitterSite || null;

    // Image: og:image > twitter:image
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    const twitterImage = document
      .querySelector('meta[name="twitter:image"]')
      ?.getAttribute("content");
    let imageUrl = ogImage || twitterImage || null;

    // Resolve relative image URLs
    if (imageUrl && !imageUrl.startsWith("http")) {
      try {
        imageUrl = new URL(imageUrl, url).toString();
      } catch {
        imageUrl = null;
      }
    }

    // Canonical URL
    const canonicalLink = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute("content");
    let canonicalUrl = canonicalLink || ogUrl || null;

    // Resolve relative canonical URLs
    if (canonicalUrl && !canonicalUrl.startsWith("http")) {
      try {
        canonicalUrl = new URL(canonicalUrl, url).toString();
      } catch {
        canonicalUrl = null;
      }
    }

    return { title, description, siteName, imageUrl, canonicalUrl };
  } catch {
    return { title: null, description: null, siteName: null, imageUrl: null, canonicalUrl: null };
  }
}
