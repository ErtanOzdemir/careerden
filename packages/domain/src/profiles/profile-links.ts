/**
 * Profile links and their pure helpers live in `@careerden/contracts` so `apps/web` can share them.
 * They are re-exported here for `@careerden/domain` consumers.
 */
export type { ProfileLink, ProfileLinkKind } from "@careerden/contracts";
export {
  formatProfileLinkLabel,
  inferProfileLinkKind,
  isHttpProfileLinkUrl,
  isProfileLinkKind,
  MAX_PROFILE_LINKS,
  normalizeProfileLinks,
  normalizeProfileLinkUrl,
  PROFILE_LINK_KIND_LABELS,
  PROFILE_LINK_KINDS,
  profileLinkKey,
} from "@careerden/contracts";
