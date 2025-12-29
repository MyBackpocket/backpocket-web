import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  return url;
}

// Client for browser/public operations
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(getSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    }
    return (_supabase as unknown as Record<string, unknown>)[prop as string];
  },
});

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(getSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!);
    }
    return (_supabaseAdmin as unknown as Record<string, unknown>)[prop as string];
  },
});

// Database types based on our schema
export interface DbSpace {
  id: string;
  type: "personal" | "org";
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  visibility: "public" | "private";
  public_layout: "list" | "grid";
  created_at: string;
  updated_at: string;
}

export interface DbMembership {
  id: string;
  space_id: string;
  user_id: string;
  role: "owner" | "admin" | "writer" | "viewer";
  status: "active" | "invited" | "removed";
  created_at: string;
  updated_at: string;
}

export interface DbSave {
  id: string;
  space_id: string;
  url: string;
  title: string | null;
  description: string | null;
  site_name: string | null;
  image_url: string | null;
  content_type: string | null;
  visibility: "private" | "public" | "unlisted";
  is_archived: boolean;
  is_favorite: boolean;
  created_by: string;
  saved_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbCollection {
  id: string;
  space_id: string;
  name: string;
  visibility: "private" | "public";
  created_at: string;
  updated_at: string;
}

export interface DbTag {
  id: string;
  space_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DbSaveTag {
  save_id: string;
  tag_id: string;
}

export interface DbSaveCollection {
  save_id: string;
  collection_id: string;
}

export type SnapshotStatus = "pending" | "processing" | "ready" | "blocked" | "failed";

export type SnapshotBlockedReason =
  | "noarchive"
  | "forbidden"
  | "not_html"
  | "too_large"
  | "invalid_url"
  | "timeout"
  | "parse_failed"
  | "ssrf_blocked"
  | "fetch_error";

export interface DbSaveSnapshot {
  save_id: string;
  space_id: string;
  status: SnapshotStatus;
  blocked_reason: SnapshotBlockedReason | null;
  attempts: number;
  next_attempt_at: string | null;
  fetched_at: string | null;
  storage_path: string | null;
  canonical_url: string | null;
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  word_count: number | null;
  language: string | null;
  content_sha256: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
