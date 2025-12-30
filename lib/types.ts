// Core types for backpocket

export type SpaceType = "personal" | "org";
export type SpaceVisibility = "public" | "private";
export type SaveVisibility = "private" | "public" | "unlisted";
export type CollectionVisibility = "private" | "public";
export type PublicLayout = "list" | "grid";

export type MembershipRole = "owner" | "admin" | "writer" | "viewer";
export type MembershipStatus = "active" | "invited" | "removed";

export interface Space {
  id: string;
  type: SpaceType;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  visibility: SpaceVisibility;
  publicLayout: PublicLayout;
  defaultSaveVisibility: SaveVisibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface Membership {
  id: string;
  spaceId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Save {
  id: string;
  spaceId: string;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  contentType: string | null;
  visibility: SaveVisibility;
  isArchived: boolean;
  isFavorite: boolean;
  createdBy: string;
  savedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  tags?: Tag[];
  collections?: Collection[];
}

export interface Collection {
  id: string;
  spaceId: string;
  name: string;
  visibility: CollectionVisibility;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  saves?: Save[];
  _count?: {
    saves: number;
  };
}

export interface Tag {
  id: string;
  spaceId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  _count?: {
    saves: number;
  };
}

export interface DomainMapping {
  id: string;
  domain: string;
  spaceId: string;
  status: "pending_verification" | "verified" | "active" | "error" | "disabled";
  verificationToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Snapshot types
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

export interface SaveSnapshot {
  saveId: string;
  spaceId: string;
  status: SnapshotStatus;
  blockedReason: SnapshotBlockedReason | null;
  attempts: number;
  nextAttemptAt: Date | null;
  fetchedAt: Date | null;
  storagePath: string | null;
  canonicalUrl: string | null;
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  wordCount: number | null;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Snapshot content returned from storage
export interface SnapshotContent {
  title: string;
  byline: string | null;
  content: string; // Sanitized HTML
  textContent: string; // Plain text version
  excerpt: string;
  siteName: string | null;
  length: number;
  language: string | null;
}

// API input/output types
export interface CreateSaveInput {
  url: string;
  title?: string;
  visibility?: SaveVisibility;
  collectionIds?: string[];
  tagNames?: string[];
  note?: string;
}

export interface UpdateSaveInput {
  id: string;
  title?: string;
  description?: string;
  visibility?: SaveVisibility;
  collectionIds?: string[];
  tagNames?: string[];
}

export interface ListSavesInput {
  query?: string;
  visibility?: SaveVisibility;
  isArchived?: boolean;
  isFavorite?: boolean;
  collectionId?: string;
  tagId?: string;
  cursor?: string;
  limit?: number;
}

export interface SpaceSettingsInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  visibility?: SpaceVisibility;
  publicLayout?: PublicLayout;
}

// Public types (for public space viewing)
export interface PublicSpace {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  publicLayout: PublicLayout;
  visitCount: number;
}

export interface PublicSave {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  savedAt: Date;
  tags?: string[];
}

// API response types (dates are serialized as strings over the wire)
export interface APISave {
  id: string;
  spaceId: string;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  contentType: string | null;
  visibility: SaveVisibility;
  isArchived: boolean;
  isFavorite: boolean;
  createdBy: string;
  savedAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
  tags?: APITag[];
  collections?: APICollection[];
}

export interface APITag {
  id: string;
  spaceId: string;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    saves: number;
  };
}

export interface APICollection {
  id: string;
  spaceId: string;
  name: string;
  visibility: CollectionVisibility;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    saves: number;
  };
}
