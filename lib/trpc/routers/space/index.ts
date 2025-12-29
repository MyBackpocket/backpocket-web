import { router } from "../../trpc";
import { collectionsRouter } from "./collections";
import { domainsRouter } from "./domains";
import { savesRouter } from "./saves";
import { settingsRouter } from "./settings";
import { statsRouter } from "./stats";
import { tagsRouter } from "./tags";

/**
 * Space router - requires authentication.
 * Composed from domain-specific sub-routers.
 */
export const spaceRouter = router({
  // Settings & profile
  getMySpace: settingsRouter.getMySpace,
  updateSettings: settingsRouter.updateSettings,
  updateSlug: settingsRouter.updateSlug,
  checkSlugAvailability: settingsRouter.checkSlugAvailability,

  // Saves
  listSaves: savesRouter.listSaves,
  getSave: savesRouter.getSave,
  createSave: savesRouter.createSave,
  updateSave: savesRouter.updateSave,
  toggleFavorite: savesRouter.toggleFavorite,
  toggleArchive: savesRouter.toggleArchive,
  deleteSave: savesRouter.deleteSave,

  // Collections
  listCollections: collectionsRouter.listCollections,
  createCollection: collectionsRouter.createCollection,
  updateCollection: collectionsRouter.updateCollection,
  deleteCollection: collectionsRouter.deleteCollection,

  // Tags
  listTags: tagsRouter.listTags,
  createTag: tagsRouter.createTag,
  updateTag: tagsRouter.updateTag,
  deleteTag: tagsRouter.deleteTag,

  // Stats & dashboard
  getStats: statsRouter.getStats,
  getDashboardData: statsRouter.getDashboardData,

  // Domains
  listDomains: domainsRouter.listDomains,
  addDomain: domainsRouter.addDomain,
  verifyDomain: domainsRouter.verifyDomain,
  getDomainStatus: domainsRouter.getDomainStatus,
  removeDomain: domainsRouter.removeDomain,
});
