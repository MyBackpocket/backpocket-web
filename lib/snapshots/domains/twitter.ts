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
const TWITTER_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i,
  /^https?:\/\/(?:mobile\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i,
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

/**
 * Check if a URL is a Twitter/X tweet URL
 */
export function isTwitterUrl(url: string): boolean {
  return TWITTER_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Parse tweet info from a Twitter/X URL
 */
function parseTweetUrl(url: string): TweetInfo | null {
  for (const pattern of TWITTER_URL_PATTERNS) {
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

    // Build readable HTML content with inline link at end
    const paragraphs = tweetText.split("\n\n").filter((p) => p.trim());
    const viewLink = `<a href="${data.url}" rel="noopener noreferrer" target="_blank">View on ${data.provider_name} →</a>`;

    const content =
      paragraphs.length > 0
        ? paragraphs
            .map((p, i) => {
              const escaped = escapeHtml(p);
              // Append link to last paragraph
              if (i === paragraphs.length - 1) {
                return `<p>${escaped} ${viewLink}</p>`;
              }
              return `<p>${escaped}</p>`;
            })
            .join("\n")
        : `<p>${viewLink}</p>`;

    // Byline with link to author profile - rendered by ReaderMode component
    const bylineHtml = `<a href="${data.author_url}" rel="noopener noreferrer" target="_blank">@${username}</a>`;

    return {
      title: `Tweet by @${username}`,
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

    if (!ogDescription) {
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

    // Build readable HTML content with inline link at end
    const paragraphs = ogDescription.split("\n\n").filter((p) => p.trim());
    const viewLink = `<a href="${url}" rel="noopener noreferrer" target="_blank">View on Twitter →</a>`;

    const content =
      paragraphs.length > 0
        ? paragraphs
            .map((p, i) => {
              const escaped = escapeHtml(p);
              // Append link to last paragraph
              if (i === paragraphs.length - 1) {
                return `<p>${escaped} ${viewLink}</p>`;
              }
              return `<p>${escaped}</p>`;
            })
            .join("\n")
        : `<p>${viewLink}</p>`;

    // Byline with link to author profile - rendered by ReaderMode component
    const authorUrl = `https://twitter.com/${tweetInfo.username}`;
    const bylineHtml = `<a href="${authorUrl}" rel="noopener noreferrer" target="_blank">@${tweetInfo.username}</a>`;

    return {
      title: ogTitle || `Tweet by @${tweetInfo.username}`,
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
