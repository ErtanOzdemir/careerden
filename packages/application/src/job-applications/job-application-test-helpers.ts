import { vi } from "vitest";
import type {
  FileStorage,
  JobApplication,
  JobApplicationChangePublisher,
  JobApplicationQueue,
  JobApplicationRepository,
  ScrapeBundle,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export function createTestJobApplication(overrides: Partial<JobApplication> = {}): JobApplication {
  const now = new Date("2026-06-14T00:00:00.000Z");
  return {
    id: "job-1",
    profileId: "profile-1",
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
    status: "scraped",
    scrapeAttemptCount: 0,
    tracking: {
      applicationStatus: "applied",
      priority: "medium",
      tags: [],
      metadata: {},
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createJobApplicationRepository(
  overrides: Partial<JobApplicationRepository> = {},
): JobApplicationRepository {
  return {
    create: vi.fn(),
    claimNextScrapeJob: vi.fn(async () => null),
    findById: vi.fn(),
    listByProfileId: vi.fn(async () => []),
    listGeneratedDocuments: vi.fn(async () => []),
    listEvents: vi.fn(async () => []),
    listContacts: vi.fn(async () => []),
    listFollowUps: vi.fn(async () => []),
    getScrapeBundle: vi.fn(async () => null),
    getMatchAnalysis: vi.fn(async () => null),
    getDocumentContent: vi.fn(async () => null),
    getCompanyLogoFileId: vi.fn(async () => null),
    updateStatus: vi.fn(),
    updateTracking: vi.fn(),
    saveScrapeBundle: vi.fn(),
    renewScrapeClaim: vi.fn(async () => null),
    recordScrapeFailure: vi.fn(async () => null),
    addEvent: vi.fn(),
    ...overrides,
  } as JobApplicationRepository;
}

export function createProfiles(): UserProfileAccessRepository {
  return {
    findUserIdByProfileId: vi.fn(async () => "user-1"),
    findById: vi.fn(async () => ({ id: "profile-1" }) as never),
  };
}

export function createStorage(overrides: Partial<FileStorage> = {}): FileStorage {
  return {
    put: vi.fn(),
    get: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as FileStorage;
}

export function createQueue(): JobApplicationQueue {
  return { enqueue: vi.fn(), restart: vi.fn() };
}

export function createJobApplicationChanges(): {
  changes: JobApplicationChangeNotifier;
  publish: ReturnType<typeof vi.fn<JobApplicationChangePublisher["publish"]>>;
} {
  const publish = vi.fn<JobApplicationChangePublisher["publish"]>();
  return { changes: new JobApplicationChangeNotifier({ publish }), publish };
}

export function createScrapeBundle(): ScrapeBundle {
  return {
    job: {
      title: "Backend Engineer",
      companyName: "Acme",
      description: "Build TypeScript services",
      requirements: ["TypeScript"],
      raw: {},
    },
  };
}
