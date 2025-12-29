// Mock data for MVP development
// This will be replaced with real Supabase queries

import type { Collection, PublicSave, PublicSpace, Save, Space, Tag } from "./types";

export const mockSpace: Space = {
  id: "space-1",
  type: "personal",
  slug: "mario",
  name: "Mario's Collection",
  bio: "A curated collection of articles, tools, and interesting finds from around the web.",
  avatarUrl: null,
  visibility: "public",
  publicLayout: "grid",
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-12-28"),
};

export const mockTags: Tag[] = [
  {
    id: "tag-1",
    spaceId: "space-1",
    name: "design",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    _count: { saves: 12 },
  },
  {
    id: "tag-2",
    spaceId: "space-1",
    name: "development",
    createdAt: new Date("2024-01-16"),
    updatedAt: new Date("2024-01-16"),
    _count: { saves: 24 },
  },
  {
    id: "tag-3",
    spaceId: "space-1",
    name: "productivity",
    createdAt: new Date("2024-01-17"),
    updatedAt: new Date("2024-01-17"),
    _count: { saves: 8 },
  },
  {
    id: "tag-4",
    spaceId: "space-1",
    name: "ai",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
    _count: { saves: 15 },
  },
  {
    id: "tag-5",
    spaceId: "space-1",
    name: "reading",
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-02-10"),
    _count: { saves: 6 },
  },
];

export const mockCollections: Collection[] = [
  {
    id: "col-1",
    spaceId: "space-1",
    name: "Must Reads",
    visibility: "public",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    _count: { saves: 15 },
  },
  {
    id: "col-2",
    spaceId: "space-1",
    name: "Dev Resources",
    visibility: "public",
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-01-20"),
    _count: { saves: 28 },
  },
  {
    id: "col-3",
    spaceId: "space-1",
    name: "Later",
    visibility: "private",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
    _count: { saves: 42 },
  },
];

export const mockSaves: Save[] = [
  {
    id: "save-1",
    spaceId: "space-1",
    url: "https://www.joshwcomeau.com/css/designing-shadows/",
    title: "Designing Beautiful Shadows in CSS",
    description:
      "A deep dive into creating realistic, beautiful shadows that elevate your designs.",
    siteName: "Josh W Comeau",
    imageUrl: "https://www.joshwcomeau.com/images/og-designing-shadows.png",
    contentType: "article",
    visibility: "public",
    isArchived: false,
    isFavorite: true,
    createdBy: "user-1",
    savedAt: new Date("2024-12-20"),
    createdAt: new Date("2024-12-20"),
    updatedAt: new Date("2024-12-20"),
    tags: [mockTags[0], mockTags[1]],
    collections: [mockCollections[0]],
  },
  {
    id: "save-2",
    spaceId: "space-1",
    url: "https://vercel.com/blog/introducing-next-16",
    title: "Introducing Next.js 16",
    description:
      "The latest version of Next.js with improved performance and developer experience.",
    siteName: "Vercel Blog",
    imageUrl: "https://vercel.com/api/og?title=Next.js%2016",
    contentType: "article",
    visibility: "public",
    isArchived: false,
    isFavorite: false,
    createdBy: "user-1",
    savedAt: new Date("2024-12-18"),
    createdAt: new Date("2024-12-18"),
    updatedAt: new Date("2024-12-18"),
    tags: [mockTags[1]],
    collections: [mockCollections[1]],
  },
  {
    id: "save-3",
    spaceId: "space-1",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Building a Second Brain - Tiago Forte",
    description: "Learn how to organize your digital life and become more productive.",
    siteName: "YouTube",
    imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    contentType: "video",
    visibility: "public",
    isArchived: false,
    isFavorite: true,
    createdBy: "user-1",
    savedAt: new Date("2024-12-15"),
    createdAt: new Date("2024-12-15"),
    updatedAt: new Date("2024-12-15"),
    tags: [mockTags[2]],
    collections: [mockCollections[0]],
  },
  {
    id: "save-4",
    spaceId: "space-1",
    url: "https://anthropic.com/research/claude-3",
    title: "Claude 3: The Next Generation of AI Assistants",
    description:
      "Anthropic introduces Claude 3, setting new benchmarks in AI reasoning and helpfulness.",
    siteName: "Anthropic",
    imageUrl: null,
    contentType: "article",
    visibility: "public",
    isArchived: false,
    isFavorite: false,
    createdBy: "user-1",
    savedAt: new Date("2024-12-10"),
    createdAt: new Date("2024-12-10"),
    updatedAt: new Date("2024-12-10"),
    tags: [mockTags[3]],
    collections: [mockCollections[1]],
  },
  {
    id: "save-5",
    spaceId: "space-1",
    url: "https://maggieappleton.com/garden-history",
    title: "A Brief History & Ethos of the Digital Garden",
    description: "Digital gardens are a different way of thinking about putting ideas online.",
    siteName: "Maggie Appleton",
    imageUrl: null,
    contentType: "article",
    visibility: "public",
    isArchived: false,
    isFavorite: true,
    createdBy: "user-1",
    savedAt: new Date("2024-12-05"),
    createdAt: new Date("2024-12-05"),
    updatedAt: new Date("2024-12-05"),
    tags: [mockTags[4], mockTags[2]],
    collections: [mockCollections[0]],
  },
  {
    id: "save-6",
    spaceId: "space-1",
    url: "https://linear.app/blog/building-linear",
    title: "How We Built Linear",
    description: "The technical and product decisions behind building Linear.",
    siteName: "Linear",
    imageUrl: null,
    contentType: "article",
    visibility: "private",
    isArchived: false,
    isFavorite: false,
    createdBy: "user-1",
    savedAt: new Date("2024-12-01"),
    createdAt: new Date("2024-12-01"),
    updatedAt: new Date("2024-12-01"),
    tags: [mockTags[1], mockTags[0]],
    collections: [mockCollections[2]],
  },
  {
    id: "save-7",
    spaceId: "space-1",
    url: "https://kentcdodds.com/blog/the-state-of-react",
    title: "The State of React in 2024",
    description: "Kent C. Dodds shares his thoughts on where React is heading.",
    siteName: "Kent C. Dodds",
    imageUrl: null,
    contentType: "article",
    visibility: "unlisted",
    isArchived: false,
    isFavorite: false,
    createdBy: "user-1",
    savedAt: new Date("2024-11-28"),
    createdAt: new Date("2024-11-28"),
    updatedAt: new Date("2024-11-28"),
    tags: [mockTags[1]],
    collections: [],
  },
  {
    id: "save-8",
    spaceId: "space-1",
    url: "https://www.robinsloan.com/lab/specifying-spring-physics/",
    title: "Specifying Spring Physics for the Web",
    description: "A wonderful exploration of spring physics for web animations.",
    siteName: "Robin Sloan",
    imageUrl: null,
    contentType: "article",
    visibility: "public",
    isArchived: true,
    isFavorite: false,
    createdBy: "user-1",
    savedAt: new Date("2024-11-20"),
    createdAt: new Date("2024-11-20"),
    updatedAt: new Date("2024-11-20"),
    tags: [mockTags[0], mockTags[1]],
    collections: [],
  },
];

export const mockVisitCount = 2847;

// Helper functions for mock data operations
export function getPublicSpace(): PublicSpace {
  return {
    id: mockSpace.id,
    slug: mockSpace.slug,
    name: mockSpace.name,
    bio: mockSpace.bio,
    avatarUrl: mockSpace.avatarUrl,
    publicLayout: mockSpace.publicLayout,
    visitCount: mockVisitCount,
  };
}

export function getPublicSaves(): PublicSave[] {
  return mockSaves
    .filter(
      (save) => (save.visibility === "public" || save.visibility === "unlisted") && !save.isArchived
    )
    .map((save) => ({
      id: save.id,
      url: save.url,
      title: save.title,
      description: save.description,
      siteName: save.siteName,
      imageUrl: save.imageUrl,
      savedAt: save.savedAt,
      tags: save.tags?.map((t) => t.name),
    }));
}

export function filterSaves(options: {
  query?: string;
  visibility?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  collectionId?: string;
  tagId?: string;
}): Save[] {
  let filtered = [...mockSaves];

  if (options.query) {
    const q = options.query.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q)
    );
  }

  if (options.visibility) {
    filtered = filtered.filter((s) => s.visibility === options.visibility);
  }

  if (options.isArchived !== undefined) {
    filtered = filtered.filter((s) => s.isArchived === options.isArchived);
  }

  if (options.isFavorite !== undefined) {
    filtered = filtered.filter((s) => s.isFavorite === options.isFavorite);
  }

  if (options.collectionId) {
    filtered = filtered.filter((s) => s.collections?.some((c) => c.id === options.collectionId));
  }

  if (options.tagId) {
    filtered = filtered.filter((s) => s.tags?.some((t) => t.id === options.tagId));
  }

  return filtered.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
}
