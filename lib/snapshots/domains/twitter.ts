/**
 * Twitter/X.com domain-specific extractor
 *
 * Uses Twitter's oEmbed API as primary source, with FxTwitter as fallback.
 * This handles tweet URLs that Readability cannot properly extract.
 */

import { parseHTML } from "linkedom";
import { SNAPSHOT_EXCERPT_LENGTH } from "@/lib/constants/snapshots";
import type { SnapshotContent } from "@/lib/types";

// Twitter oEmbed API endpoint
const TWITTER_OEMBED_URL = "https://publish.twitter.com/oembed";

// Regex patterns to match Twitter/X URLs and extract tweet IDs
const TWITTER_TWEET_PATTERNS = [
  /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i,
  /^https?:\/\/(?:mobile\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i,
];

// X Articles use /article/ instead of /status/
const TWITTER_ARTICLE_PATTERN =
  /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/article\/(\d+)/i;

// Content that indicates we got an error/login page instead of actual content
const ERROR_PAGE_INDICATORS = [
  /^log\s*in$/i,
  /^sign\s*up$/i,
  /^something went wrong/i,
  /^tweet$/i, // Generic "Tweet" title without username
];

interface TwitterOEmbedResponse {
  url: string;
  author_name: string;
  author_url: string;
  html: string;
  provider_name: string;
  provider_url: string;
}

interface TweetInfo {
  username: string;
  tweetId: string;
}

// Twitter epoch: November 4, 2010 at 01:42:54.657 UTC
const TWITTER_EPOCH = BigInt("1288834974657");

/**
 * Extract timestamp from a Twitter/X Snowflake ID
 * Twitter IDs encode the creation timestamp in the upper bits
 */
function getDateFromSnowflakeId(id: string): Date | null {
  try {
    const snowflakeId = BigInt(id);
    // Timestamp is in the upper 41 bits (shift right 22 bits)
    const timestampMs = (snowflakeId >> BigInt(22)) + TWITTER_EPOCH;
    return new Date(Number(timestampMs));
  } catch {
    return null;
  }
}

/**
 * Format a date for display in byline (e.g., "Jan 5, 2026")
 */
function formatBylineDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Generate a descriptive title from username and tweet content
 * Format: "Tweet by @username: first ~50 chars..."
 */
function generateTweetTitle(username: string, content: string): string {
  const baseTitle = `Tweet by @${username}`;

  if (!content || content.trim().length === 0) {
    return baseTitle;
  }

  const trimmedContent = content.trim();
  const maxLength = 50;

  if (trimmedContent.length <= maxLength) {
    return `${baseTitle}: ${trimmedContent}`;
  }

  // Truncate at word boundary
  let truncated = trimmedContent.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  // If there's a reasonable word boundary (at least 70% of max length), use it
  if (lastSpace > maxLength * 0.7) {
    truncated = truncated.slice(0, lastSpace);
  }

  return `${baseTitle}: ${truncated}...`;
}

/**
 * Check if content appears to be from an error/login page
 */
function isErrorPageContent(content: string | null | undefined): boolean {
  if (!content) return true;
  const trimmed = content.trim();
  if (trimmed.length === 0) return true;
  return ERROR_PAGE_INDICATORS.some((pattern) => pattern.test(trimmed));
}

/**
 * Check if a URL is a Twitter/X tweet URL
 */
export function isTwitterUrl(url: string): boolean {
  return (
    TWITTER_TWEET_PATTERNS.some((pattern) => pattern.test(url)) || TWITTER_ARTICLE_PATTERN.test(url)
  );
}

/**
 * Check if a URL is an X Article (not a regular tweet)
 */
function isArticleUrl(url: string): boolean {
  return TWITTER_ARTICLE_PATTERN.test(url);
}

/**
 * Parse tweet info from a Twitter/X URL
 */
function parseTweetUrl(url: string): TweetInfo | null {
  for (const pattern of TWITTER_TWEET_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return {
        username: match[1],
        tweetId: match[2],
      };
    }
  }
  return null;
}

/**
 * Extract tweet text from oEmbed HTML response
 * The HTML is a blockquote containing the tweet content
 */
function extractTweetTextFromHtml(html: string): string {
  try {
    const { document } = parseHTML(html);

    // The oEmbed HTML is a blockquote with the tweet content
    const blockquote = document.querySelector("blockquote");
    if (!blockquote) {
      return "";
    }

    // Get all paragraph elements (tweet content)
    const paragraphs = blockquote.querySelectorAll("p");
    const textParts: string[] = [];

    for (const p of paragraphs) {
      const text = p.textContent?.trim();
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join("\n\n");
  } catch {
    return "";
  }
}

/**
 * Try to extract tweet via Twitter's official oEmbed API
 */
async function tryTwitterOEmbed(url: string): Promise<SnapshotContent | null> {
  try {
    const oembedUrl = new URL(TWITTER_OEMBED_URL);
    oembedUrl.searchParams.set("url", url);
    oembedUrl.searchParams.set("omit_script", "true");

    const response = await fetch(oembedUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as TwitterOEmbedResponse;

    // Extract the tweet text from the HTML blockquote
    const tweetText = extractTweetTextFromHtml(data.html);

    if (!tweetText) {
      return null;
    }

    // Build excerpt
    let excerpt = tweetText;
    if (excerpt.length > SNAPSHOT_EXCERPT_LENGTH) {
      excerpt = excerpt.slice(0, SNAPSHOT_EXCERPT_LENGTH);
      const lastSpace = excerpt.lastIndexOf(" ");
      if (lastSpace > SNAPSHOT_EXCERPT_LENGTH * 0.8) {
        excerpt = `${excerpt.slice(0, lastSpace)}...`;
      } else {
        excerpt = `${excerpt}...`;
      }
    }

    // Extract username from author URL (e.g., "https://twitter.com/4nzn" -> "4nzn")
    const usernameMatch = data.author_url.match(/(?:twitter\.com|x\.com)\/(\w+)/i);
    const username = usernameMatch ? usernameMatch[1] : data.author_name;

    // Extract tweet date from Snowflake ID
    const tweetInfo = parseTweetUrl(url);
    const tweetDate = tweetInfo ? getDateFromSnowflakeId(tweetInfo.tweetId) : null;
    const dateStr = tweetDate ? ` · ${formatBylineDate(tweetDate)}` : "";

    // Build readable HTML content
    const paragraphs = tweetText.split("\n\n").filter((p) => p.trim());

    const content =
      paragraphs.length > 0 ? paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n") : "";

    // Byline with link to author profile and date - rendered by ReaderMode component
    const bylineHtml = `<a href="${data.author_url}" rel="noopener noreferrer" target="_blank">@${username}</a>${dateStr}`;

    return {
      title: generateTweetTitle(username, tweetText),
      byline: bylineHtml,
      content,
      textContent: tweetText,
      excerpt,
      siteName: data.provider_name || "Twitter",
      length: tweetText.length,
      language: null,
    };
  } catch {
    return null;
  }
}

/**
 * Try to extract tweet via FxTwitter (fallback)
 * FxTwitter provides better OG tags for tweets
 */
async function tryFxTwitter(url: string): Promise<SnapshotContent | null> {
  const tweetInfo = parseTweetUrl(url);
  if (!tweetInfo) {
    return null;
  }

  try {
    const fxUrl = `https://fxtwitter.com/${tweetInfo.username}/status/${tweetInfo.tweetId}`;

    const response = await fetch(fxUrl, {
      headers: {
        "User-Agent": "bot",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    // Extract OG metadata
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
    const ogDescription = document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content");
    const ogSiteName = document
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute("content");

    // Check if we got error page content instead of actual tweet
    if (!ogDescription || isErrorPageContent(ogDescription) || isErrorPageContent(ogTitle)) {
      return null;
    }

    // Build excerpt
    let excerpt = ogDescription;
    if (excerpt.length > SNAPSHOT_EXCERPT_LENGTH) {
      excerpt = excerpt.slice(0, SNAPSHOT_EXCERPT_LENGTH);
      const lastSpace = excerpt.lastIndexOf(" ");
      if (lastSpace > SNAPSHOT_EXCERPT_LENGTH * 0.8) {
        excerpt = `${excerpt.slice(0, lastSpace)}...`;
      } else {
        excerpt = `${excerpt}...`;
      }
    }

    // Build readable HTML content
    const paragraphs = ogDescription.split("\n\n").filter((p) => p.trim());

    const content =
      paragraphs.length > 0 ? paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n") : "";

    // Extract tweet date from Snowflake ID
    const tweetDate = getDateFromSnowflakeId(tweetInfo.tweetId);
    const dateStr = tweetDate ? ` · ${formatBylineDate(tweetDate)}` : "";

    // Byline with link to author profile and date - rendered by ReaderMode component
    const authorUrl = `https://twitter.com/${tweetInfo.username}`;
    const bylineHtml = `<a href="${authorUrl}" rel="noopener noreferrer" target="_blank">@${tweetInfo.username}</a>${dateStr}`;

    return {
      // Always use generated title for consistency (includes content snippet)
      title: generateTweetTitle(tweetInfo.username, ogDescription),
      byline: bylineHtml,
      content,
      textContent: ogDescription,
      excerpt,
      siteName: ogSiteName || "Twitter",
      length: ogDescription.length,
      language: null,
    };
  } catch {
    return null;
  }
}

/**
 * Simple HTML escaping for user content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Extract tweet content from a Twitter/X URL
 * Tries oEmbed first, falls back to FxTwitter
 */
export async function extractTweet(url: string): Promise<SnapshotContent | null> {
  // X Articles (/article/) are not supported - they require authentication
  // and don't work with oEmbed or FxTwitter
  if (isArticleUrl(url)) {
    // Return a placeholder result so we don't fall back to Readability
    // (which would just extract the login page)
    const match = url.match(TWITTER_ARTICLE_PATTERN);
    const username = match ? match[1] : "unknown";
    const articleId = match ? match[2] : null;

    // Extract article date from Snowflake ID
    const articleDate = articleId ? getDateFromSnowflakeId(articleId) : null;
    const dateStr = articleDate ? ` · ${formatBylineDate(articleDate)}` : "";

    return {
      title: `X Article by @${username}`,
      byline: `<a href="https://x.com/${username}" rel="noopener noreferrer" target="_blank">@${username}</a>${dateStr}`,
      content: `<p>X Articles require authentication and cannot be snapshotted. <a href="${url}" rel="noopener noreferrer" target="_blank">View the original article on X</a>.</p>`,
      textContent: "X Articles require authentication and cannot be snapshotted.",
      excerpt: "X Articles require authentication and cannot be snapshotted.",
      siteName: "X",
      length: 0,
      language: null,
    };
  }

  // Try Twitter oEmbed API first (official, most reliable)
  const oembedResult = await tryTwitterOEmbed(url);
  if (oembedResult) {
    return oembedResult;
  }

  // Fall back to FxTwitter
  const fxResult = await tryFxTwitter(url);
  if (fxResult) {
    return fxResult;
  }

  return null;
}
