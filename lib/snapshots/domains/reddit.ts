/**
 * Reddit domain-specific extractor
 *
 * Uses old.reddit.com HTML for extraction since it has cleaner,
 * more predictable HTML structure without JavaScript requirements.
 */

import { parseHTML } from "linkedom";
import { SNAPSHOT_EXCERPT_LENGTH } from "@/lib/constants/snapshots";
import type { SnapshotContent } from "@/lib/types";

// Reddit URL patterns
const REDDIT_DOMAINS = [
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
  "new.reddit.com",
  "np.reddit.com",
  "m.reddit.com",
  "i.reddit.com",
];

// Short URL pattern (redd.it)
const REDDIT_SHORT_PATTERN = /^https?:\/\/redd\.it\/(\w+)/i;

// Post URL pattern: /r/subreddit/comments/postId/title_slug/
const REDDIT_POST_PATTERN =
  /^https?:\/\/(?:(?:www|old|new|np|m|i)\.)?reddit\.com\/r\/(\w+)\/comments\/(\w+)(?:\/([^/?]+))?/i;

// Comment URL pattern: /r/subreddit/comments/postId/title_slug/commentId/
const REDDIT_COMMENT_PATTERN =
  /^https?:\/\/(?:(?:www|old|new|np|m|i)\.)?reddit\.com\/r\/(\w+)\/comments\/(\w+)\/([^/?]+)\/(\w+)/i;

// Subreddit URL pattern: /r/subreddit/
const REDDIT_SUBREDDIT_PATTERN =
  /^https?:\/\/(?:(?:www|old|new|np|m|i)\.)?reddit\.com\/r\/(\w+)\/?(?:\?.*)?$/i;

// User URL pattern: /u/username/ or /user/username/
const REDDIT_USER_PATTERN =
  /^https?:\/\/(?:(?:www|old|new|np|m|i)\.)?reddit\.com\/u(?:ser)?\/([^/?]+)/i;

// Content indicators for error states
const ERROR_INDICATORS = [
  /this community is private/i,
  /you must be invited/i,
  /page not found/i,
  /this subreddit is quarantined/i,
  /content is not available/i,
];

const DELETED_CONTENT_INDICATORS = ["[deleted]", "[removed]"];

type RedditContentType = "post" | "comment" | "subreddit" | "user";

interface RedditUrlInfo {
  type: RedditContentType;
  subreddit?: string;
  postId?: string;
  titleSlug?: string;
  commentId?: string;
  username?: string;
  originalUrl: string;
}

/**
 * Check if a URL is a Reddit URL
 */
export function isRedditUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check redd.it short URLs
    if (hostname === "redd.it") {
      return true;
    }

    // Check main Reddit domains
    return REDDIT_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Parse a Reddit URL and determine its content type
 */
function parseRedditUrl(url: string): RedditUrlInfo | null {
  // Handle redd.it short URLs
  const shortMatch = url.match(REDDIT_SHORT_PATTERN);
  if (shortMatch) {
    return {
      type: "post",
      postId: shortMatch[1],
      originalUrl: url,
    };
  }

  // Check for comment (must check before post since it's more specific)
  const commentMatch = url.match(REDDIT_COMMENT_PATTERN);
  if (commentMatch) {
    return {
      type: "comment",
      subreddit: commentMatch[1],
      postId: commentMatch[2],
      titleSlug: commentMatch[3],
      commentId: commentMatch[4],
      originalUrl: url,
    };
  }

  // Check for post
  const postMatch = url.match(REDDIT_POST_PATTERN);
  if (postMatch) {
    return {
      type: "post",
      subreddit: postMatch[1],
      postId: postMatch[2],
      titleSlug: postMatch[3],
      originalUrl: url,
    };
  }

  // Check for subreddit
  const subredditMatch = url.match(REDDIT_SUBREDDIT_PATTERN);
  if (subredditMatch) {
    return {
      type: "subreddit",
      subreddit: subredditMatch[1],
      originalUrl: url,
    };
  }

  // Check for user
  const userMatch = url.match(REDDIT_USER_PATTERN);
  if (userMatch) {
    return {
      type: "user",
      username: userMatch[1],
      originalUrl: url,
    };
  }

  return null;
}

/**
 * Convert a Reddit URL to old.reddit.com equivalent for scraping
 */
function toOldRedditUrl(info: RedditUrlInfo): string {
  switch (info.type) {
    case "post":
      if (info.subreddit && info.postId) {
        const slug = info.titleSlug ? `/${info.titleSlug}` : "";
        return `https://old.reddit.com/r/${info.subreddit}/comments/${info.postId}${slug}`;
      }
      // Short URL - need to resolve
      return `https://old.reddit.com/${info.postId}`;

    case "comment":
      return `https://old.reddit.com/r/${info.subreddit}/comments/${info.postId}/${info.titleSlug}/${info.commentId}`;

    case "subreddit":
      return `https://old.reddit.com/r/${info.subreddit}`;

    case "user":
      return `https://old.reddit.com/u/${info.username}`;
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
 * Generate an excerpt from text content
 */
function generateExcerpt(text: string): string {
  let excerpt = text.trim();
  if (excerpt.length > SNAPSHOT_EXCERPT_LENGTH) {
    excerpt = excerpt.slice(0, SNAPSHOT_EXCERPT_LENGTH);
    const lastSpace = excerpt.lastIndexOf(" ");
    if (lastSpace > SNAPSHOT_EXCERPT_LENGTH * 0.8) {
      excerpt = `${excerpt.slice(0, lastSpace)}...`;
    } else {
      excerpt = `${excerpt}...`;
    }
  }
  return excerpt;
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
 * Parse Reddit's time element to get a Date
 */
function parseRedditTime(timeElement: Element | null): Date | null {
  if (!timeElement) return null;

  const datetime = timeElement.getAttribute("datetime");
  if (datetime) {
    const date = new Date(datetime);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const title = timeElement.getAttribute("title");
  if (title) {
    const date = new Date(title);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Check if content appears to be an error page
 */
function isErrorPage(document: Document): boolean {
  const pageContent = document.body?.textContent || "";
  return ERROR_INDICATORS.some((pattern) => pattern.test(pageContent));
}

/**
 * Check if content has been deleted or removed
 */
function isDeletedContent(text: string): boolean {
  const trimmed = text.trim();
  return DELETED_CONTENT_INDICATORS.some((indicator) =>
    trimmed.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Fetch a page from old.reddit.com
 */
async function fetchOldReddit(url: string): Promise<Document | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BackpocketBot/1.0; +https://backpocket.app)",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const { document } = parseHTML(html);
    return document;
  } catch {
    return null;
  }
}

/**
 * Extract content from a Reddit post
 */
async function extractRedditPost(info: RedditUrlInfo): Promise<SnapshotContent | null> {
  const url = toOldRedditUrl(info);
  const document = await fetchOldReddit(url);

  if (!document || isErrorPage(document)) {
    return null;
  }

  // Find the post container - old.reddit uses .thing with data-fullname
  const postContainer =
    document.querySelector(".thing.link") || document.querySelector('[data-type="link"]');

  if (!postContainer) {
    return null;
  }

  // Extract title
  const titleElement =
    postContainer.querySelector(".title a.title") || postContainer.querySelector("a.title");
  const title = titleElement?.textContent?.trim() || "Reddit Post";

  // Extract subreddit
  const subredditElement = postContainer.querySelector(".subreddit");
  const subreddit = subredditElement?.textContent?.trim() || info.subreddit || "";

  // Extract author
  const authorElement = postContainer.querySelector(".author");
  const author = authorElement?.textContent?.trim() || "[deleted]";

  // Extract timestamp
  const timeElement = postContainer.querySelector("time");
  const postDate = parseRedditTime(timeElement);

  // Extract score
  const scoreElement =
    postContainer.querySelector(".score.unvoted") || postContainer.querySelector(".score");
  const score = scoreElement?.getAttribute("title") || scoreElement?.textContent?.trim();

  // Extract self-text (for text posts)
  const selfTextElement =
    document.querySelector(".expando .usertext-body .md") ||
    document.querySelector(".selftext .md");
  let selfText = "";
  let selfTextHtml = "";

  if (selfTextElement) {
    selfText = selfTextElement.textContent?.trim() || "";
    selfTextHtml = selfTextElement.innerHTML || "";

    // Check if content was deleted
    if (isDeletedContent(selfText)) {
      selfText = "[This content has been deleted or removed]";
      selfTextHtml = `<p><em>${selfText}</em></p>`;
    }
  }

  // Extract link URL (for link posts)
  const linkElement = postContainer.querySelector("a.title");
  const linkUrl = linkElement?.getAttribute("href");
  const isExternalLink = linkUrl && !linkUrl.includes("reddit.com") && !linkUrl.startsWith("/");

  // Build content HTML
  let contentHtml = "";

  if (isExternalLink) {
    contentHtml += `<p><strong>Link:</strong> <a href="${escapeHtml(linkUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(linkUrl)}</a></p>`;
  }

  if (selfTextHtml) {
    contentHtml += selfTextHtml;
  }

  if (!contentHtml) {
    contentHtml = "<p><em>This post contains no text content.</em></p>";
  }

  // Build text content for excerpt
  let textContent = selfText || title;
  if (isExternalLink) {
    textContent = `Link: ${linkUrl}\n\n${selfText || ""}`.trim();
  }

  // Build byline
  const dateStr = postDate ? ` · ${formatBylineDate(postDate)}` : "";
  const scoreStr = score ? ` · ${score} points` : "";
  const bylineHtml = `<a href="https://reddit.com/u/${escapeHtml(author)}" rel="noopener noreferrer" target="_blank">u/${escapeHtml(author)}</a> in <a href="https://reddit.com/r/${escapeHtml(subreddit.replace(/^r\//, ""))}" rel="noopener noreferrer" target="_blank">${escapeHtml(subreddit)}</a>${scoreStr}${dateStr}`;

  // Generate title with content snippet
  const displayTitle = generatePostTitle(author, subreddit, title);

  return {
    title: displayTitle,
    byline: bylineHtml,
    content: contentHtml,
    textContent,
    excerpt: generateExcerpt(textContent),
    siteName: "Reddit",
    length: textContent.length,
    language: null,
  };
}

/**
 * Generate a descriptive title for a post
 */
function generatePostTitle(author: string, subreddit: string, title: string): string {
  const prefix = subreddit ? `Post in r/${subreddit.replace(/^r\//, "")}` : `Post by u/${author}`;

  const maxLength = 60;
  if (title.length <= maxLength) {
    return `${prefix}: ${title}`;
  }

  let truncated = title.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    truncated = truncated.slice(0, lastSpace);
  }

  return `${prefix}: ${truncated}...`;
}

/**
 * Extract content from a Reddit comment
 */
async function extractRedditComment(info: RedditUrlInfo): Promise<SnapshotContent | null> {
  const url = toOldRedditUrl(info);
  const document = await fetchOldReddit(url);

  if (!document || isErrorPage(document)) {
    return null;
  }

  // Find the targeted comment
  const commentId = info.commentId;
  const commentContainer =
    document.querySelector(`#thing_t1_${commentId}`) ||
    document.querySelector(`.comment[data-fullname="t1_${commentId}"]`) ||
    document.querySelector(".comment.target") ||
    document.querySelector(".comment");

  if (!commentContainer) {
    return null;
  }

  // Get parent post title
  const postTitleElement = document.querySelector(".title a.title");
  const postTitle = postTitleElement?.textContent?.trim() || "Reddit Post";

  // Extract comment author
  const authorElement = commentContainer.querySelector(".author");
  const author = authorElement?.textContent?.trim() || "[deleted]";

  // Extract subreddit
  const subredditElement = document.querySelector(".subreddit");
  const subreddit = subredditElement?.textContent?.trim() || info.subreddit || "";

  // Extract comment text
  const commentBodyElement = commentContainer.querySelector(".usertext-body .md");
  let commentText = commentBodyElement?.textContent?.trim() || "";
  let commentHtml = commentBodyElement?.innerHTML || "";

  if (isDeletedContent(commentText)) {
    commentText = "[This comment has been deleted or removed]";
    commentHtml = `<p><em>${commentText}</em></p>`;
  }

  // Extract timestamp
  const timeElement = commentContainer.querySelector("time");
  const commentDate = parseRedditTime(timeElement);

  // Extract score
  const scoreElement = commentContainer.querySelector(".score.unvoted");
  const score = scoreElement?.getAttribute("title") || scoreElement?.textContent?.trim();

  // Build content HTML with context
  let contentHtml = `<p><strong>Comment on:</strong> <a href="https://reddit.com/r/${escapeHtml(subreddit.replace(/^r\//, ""))}/comments/${info.postId}" rel="noopener noreferrer" target="_blank">${escapeHtml(postTitle)}</a></p>`;
  contentHtml += "<hr />";
  contentHtml += commentHtml || "<p><em>No content</em></p>";

  // Build byline
  const dateStr = commentDate ? ` · ${formatBylineDate(commentDate)}` : "";
  const scoreStr = score ? ` · ${score} points` : "";
  const bylineHtml = `<a href="https://reddit.com/u/${escapeHtml(author)}" rel="noopener noreferrer" target="_blank">u/${escapeHtml(author)}</a> in <a href="https://reddit.com/r/${escapeHtml(subreddit.replace(/^r\//, ""))}" rel="noopener noreferrer" target="_blank">${escapeHtml(subreddit)}</a>${scoreStr}${dateStr}`;

  // Generate title
  const displayTitle = `Comment by u/${author}: ${generateExcerpt(commentText).slice(0, 50)}${commentText.length > 50 ? "..." : ""}`;

  return {
    title: displayTitle,
    byline: bylineHtml,
    content: contentHtml,
    textContent: commentText,
    excerpt: generateExcerpt(commentText),
    siteName: "Reddit",
    length: commentText.length,
    language: null,
  };
}

/**
 * Extract information about a subreddit
 */
async function extractSubredditInfo(info: RedditUrlInfo): Promise<SnapshotContent | null> {
  const url = toOldRedditUrl(info);
  const document = await fetchOldReddit(url);

  if (!document || isErrorPage(document)) {
    // Check if it's a private subreddit
    const pageContent = document?.body?.textContent || "";
    if (/this community is private/i.test(pageContent)) {
      return {
        title: `r/${info.subreddit}`,
        byline: "Private subreddit",
        content: `<p>This subreddit is private. You must be invited to view this community.</p>`,
        textContent: "This subreddit is private.",
        excerpt: "This subreddit is private.",
        siteName: "Reddit",
        length: 0,
        language: null,
      };
    }
    return null;
  }

  const subreddit = info.subreddit || "";

  // Extract description from sidebar
  const descriptionElement =
    document.querySelector(".side .md") || document.querySelector(".titlebox .usertext-body .md");
  const description = descriptionElement?.textContent?.trim() || "";
  const descriptionHtml = descriptionElement?.innerHTML || "";

  // Extract subscriber count
  const subscriberElement = document.querySelector(".subscribers .number");
  const subscribers = subscriberElement?.textContent?.trim() || "";

  // Extract active users
  const activeElement = document.querySelector(".users-online .number");
  const activeUsers = activeElement?.textContent?.trim() || "";

  // Extract subreddit title/tagline
  const taglineElement = document.querySelector(".titlebox h1.redditname");
  const tagline = taglineElement?.textContent?.trim() || `r/${subreddit}`;

  // Build content HTML
  let contentHtml = `<h2>${escapeHtml(tagline)}</h2>`;

  if (subscribers || activeUsers) {
    contentHtml += "<p>";
    if (subscribers) {
      contentHtml += `<strong>${escapeHtml(subscribers)}</strong> subscribers`;
    }
    if (subscribers && activeUsers) {
      contentHtml += " · ";
    }
    if (activeUsers) {
      contentHtml += `<strong>${escapeHtml(activeUsers)}</strong> online`;
    }
    contentHtml += "</p>";
  }

  if (descriptionHtml) {
    contentHtml += "<hr />";
    contentHtml += descriptionHtml;
  } else {
    contentHtml += "<p><em>No description available.</em></p>";
  }

  // Build byline
  const statsStr = subscribers ? `${subscribers} subscribers` : "";
  const bylineHtml = statsStr || "Reddit community";

  // Text content for excerpt
  const textContent = description || `r/${subreddit} - Reddit community`;

  return {
    title: `r/${subreddit}`,
    byline: bylineHtml,
    content: contentHtml,
    textContent,
    excerpt: generateExcerpt(textContent),
    siteName: "Reddit",
    length: textContent.length,
    language: null,
  };
}

/**
 * Extract information about a Reddit user
 */
async function extractUserProfile(info: RedditUrlInfo): Promise<SnapshotContent | null> {
  const url = toOldRedditUrl(info);
  const document = await fetchOldReddit(url);

  if (!document || isErrorPage(document)) {
    return null;
  }

  const username = info.username || "";

  // Extract karma from the sidebar
  const karmaElement = document.querySelector(".karma");
  const karma = karmaElement?.textContent?.trim() || "";

  // Extract account age
  const ageElement = document.querySelector(".age time");
  const accountAge = parseRedditTime(ageElement);

  // Extract trophy case or summary info
  const trophyElements = document.querySelectorAll(".trophy-name");
  const trophies: string[] = [];
  for (const el of trophyElements) {
    const trophy = el.textContent?.trim();
    if (trophy) {
      trophies.push(trophy);
    }
  }

  // Get recent post titles for summary
  const postElements = document.querySelectorAll(".thing.link .title a.title");
  const recentPosts: string[] = [];
  let count = 0;
  for (const el of postElements) {
    if (count >= 5) break;
    const postTitle = el.textContent?.trim();
    if (postTitle) {
      recentPosts.push(postTitle);
      count++;
    }
  }

  // Build content HTML
  let contentHtml = `<h2>u/${escapeHtml(username)}</h2>`;

  if (karma) {
    contentHtml += `<p><strong>Karma:</strong> ${escapeHtml(karma)}</p>`;
  }

  if (accountAge) {
    contentHtml += `<p><strong>Account created:</strong> ${formatBylineDate(accountAge)}</p>`;
  }

  if (trophies.length > 0) {
    contentHtml += "<h3>Trophies</h3>";
    contentHtml += `<p>${trophies.map((t) => escapeHtml(t)).join(", ")}</p>`;
  }

  if (recentPosts.length > 0) {
    contentHtml += "<h3>Recent Activity</h3>";
    contentHtml += "<ul>";
    for (const post of recentPosts) {
      contentHtml += `<li>${escapeHtml(post)}</li>`;
    }
    contentHtml += "</ul>";
  }

  // Build byline
  const ageStr = accountAge ? `Redditor since ${formatBylineDate(accountAge)}` : "";
  const karmaStr = karma ? `${karma} karma` : "";
  const bylineParts = [karmaStr, ageStr].filter(Boolean);
  const bylineHtml = bylineParts.join(" · ") || "Reddit user";

  // Text content for excerpt
  const textContent = `u/${username} - ${bylineParts.join(", ") || "Reddit user"}`;

  return {
    title: `u/${username}`,
    byline: bylineHtml,
    content: contentHtml,
    textContent,
    excerpt: generateExcerpt(textContent),
    siteName: "Reddit",
    length: textContent.length,
    language: null,
  };
}

/**
 * Resolve a redd.it short URL to get the full URL info
 */
async function resolveShortUrl(info: RedditUrlInfo): Promise<RedditUrlInfo | null> {
  const shortUrl = `https://redd.it/${info.postId}`;

  try {
    const response = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    // The final URL after redirects should be the full Reddit URL
    const finalUrl = response.url;
    const parsedInfo = parseRedditUrl(finalUrl);

    if (parsedInfo) {
      return parsedInfo;
    }

    // If we can't parse it, add the info we have
    return {
      ...info,
      originalUrl: finalUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Main extraction function - handles all Reddit URL types
 */
export async function extractReddit(url: string): Promise<SnapshotContent | null> {
  const urlInfo = parseRedditUrl(url);

  if (!urlInfo) {
    return null;
  }

  // Resolve short URLs first
  let resolvedInfo = urlInfo;
  if (urlInfo.type === "post" && !urlInfo.subreddit && urlInfo.postId) {
    const resolved = await resolveShortUrl(urlInfo);
    if (resolved) {
      resolvedInfo = resolved;
    }
  }

  // Route to the appropriate extractor
  switch (resolvedInfo.type) {
    case "post":
      return extractRedditPost(resolvedInfo);

    case "comment":
      return extractRedditComment(resolvedInfo);

    case "subreddit":
      return extractSubredditInfo(resolvedInfo);

    case "user":
      return extractUserProfile(resolvedInfo);

    default:
      return null;
  }
}
