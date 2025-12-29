/**
 * HTML sanitization utilities for snapshot content
 */

import sanitizeHtml from "sanitize-html";

// Allowed tags for reader mode (conservative list)
const ALLOWED_TAGS = [
  // Block elements
  "article",
  "section",
  "header",
  "footer",
  "aside",
  "nav",
  "main",
  "div",
  "p",
  "blockquote",
  "pre",
  "code",
  "hr",
  // Headings
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  // Lists
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  // Inline elements
  "a",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "mark",
  "sub",
  "sup",
  "small",
  "abbr",
  "cite",
  "q",
  "time",
  "kbd",
  "samp",
  "var",
  // Media (with restrictions)
  "img",
  "figure",
  "figcaption",
  "picture",
  "source",
  // Tables
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
  // Other
  "br",
  "wbr",
];

// Allowed attributes per tag
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  source: ["srcset", "media", "type"],
  blockquote: ["cite"],
  q: ["cite"],
  time: ["datetime"],
  abbr: ["title"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  col: ["span"],
  colgroup: ["span"],
  // Allow data attributes for accessibility
  "*": ["id", "class", "lang", "dir"],
};

// URL schemes allowed in href/src attributes
const ALLOWED_URL_SCHEMES = ["http", "https", "mailto"];

/**
 * Sanitize HTML content for safe rendering in reader mode
 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_URL_SCHEMES,
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    // Transform tags
    transformTags: {
      // Force all links to open in new tab and add security attributes
      a: (_tagName, attribs) => {
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        };
      },
      // Add lazy loading to images
      img: (_tagName, attribs) => {
        return {
          tagName: "img",
          attribs: {
            ...attribs,
            loading: "lazy",
          },
        };
      },
    },
    // Remove empty elements that don't have a purpose
    exclusiveFilter: (frame) => {
      // Remove empty tags except those that are self-closing or have specific purpose
      const selfClosing = ["br", "hr", "img", "source", "col", "wbr"];
      if (selfClosing.includes(frame.tag)) {
        return false;
      }
      // Keep elements with content or non-empty attributes
      const hasContent = frame.text?.trim();
      const hasChildren = (frame as { children?: unknown[] }).children?.length;
      return !hasContent && !hasChildren;
    },
    // Don't parse style attributes
    parseStyleAttributes: false,
    // Enforce HTTPS on external resources when possible
    enforceHtmlBoundary: true,
  });
}

/**
 * Strip all HTML tags, returning plain text
 */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Basic HTML entity encoding for safe text display
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}
