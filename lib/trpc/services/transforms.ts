import type { Collection, Save, Tag } from "@/lib/types";

/**
 * Transform a database save record to the Save type.
 */
export function transformSave(
  dbSave: Record<string, unknown>,
  tags: Tag[] = [],
  collections: Collection[] = []
): Save {
  return {
    id: dbSave.id as string,
    spaceId: dbSave.space_id as string,
    url: dbSave.url as string,
    title: dbSave.title as string | null,
    description: dbSave.description as string | null,
    siteName: dbSave.site_name as string | null,
    imageUrl: dbSave.image_url as string | null,
    contentType: dbSave.content_type as string | null,
    visibility: dbSave.visibility as "private" | "public" | "unlisted",
    isArchived: dbSave.is_archived as boolean,
    isFavorite: dbSave.is_favorite as boolean,
    createdBy: dbSave.created_by as string,
    savedAt: new Date(dbSave.saved_at as string),
    createdAt: new Date(dbSave.created_at as string),
    updatedAt: new Date(dbSave.updated_at as string),
    tags,
    collections,
  };
}
