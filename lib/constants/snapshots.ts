/**
 * Snapshot configuration constants
 */

// Feature flag - check environment variable
export const SNAPSHOTS_ENABLED = process.env.SNAPSHOTS_ENABLED !== "false";

// Fetch limits
export const SNAPSHOT_FETCH_TIMEOUT_MS = 15_000; // 15 seconds
export const SNAPSHOT_MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB
export const SNAPSHOT_MAX_REDIRECTS = 5;

// Retry configuration
export const SNAPSHOT_MAX_ATTEMPTS = 3;
export const SNAPSHOT_RETRY_DELAYS_MS = [
  5 * 60 * 1000, // 5 minutes
  30 * 60 * 1000, // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
];

// Content limits
export const SNAPSHOT_MAX_TEXT_LENGTH = 500_000; // 500k characters
export const SNAPSHOT_EXCERPT_LENGTH = 500;

// Rate limits
export const SNAPSHOT_USER_RATE_LIMIT = 100; // per day
export const SNAPSHOT_USER_RATE_WINDOW_SECONDS = 86400; // 24 hours
export const SNAPSHOT_DOMAIN_POLITENESS_MS = 1000; // 1 second between requests to same domain

// Storage configuration
export const SNAPSHOT_STORAGE_BUCKET = "backpocket-blob-storage-primary";
export const SNAPSHOT_STORAGE_PATH_PREFIX = "snapshots"; // Path prefix within the bucket

// Allowed content types for snapshot fetching
export const SNAPSHOT_ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

// User agent for fetching
export const SNAPSHOT_USER_AGENT = "BackpocketBot/1.0 (+https://backpocket.dev/bot; like Pocket)";
