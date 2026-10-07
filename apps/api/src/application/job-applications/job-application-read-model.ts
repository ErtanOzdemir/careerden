import type {
  DocumentContent,
  FileStorage,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle,
  ProfileReadiness,
} from "@careerden/domain";

export type JobApplicationWithDocuments = JobApplication & {
  documents: GeneratedDocument[];
  companyLogoUrl?: string;
  matchScore?: number;
};

export type JobApplicationDetail = JobApplicationWithDocuments & {
  events: JobApplicationEvent[];
  contacts: JobApplicationContact[];
  followUps: JobApplicationFollowUp[];
  scrapeBundle: ScrapeBundle | null;
  matchAnalysis: MatchAnalysisResult | null;
  documentContent: DocumentContent | null;
  profileReadiness: ProfileReadiness;
};

export async function buildJobApplicationDetail(input: {
  jobApplications: JobApplicationRepository;
  storage: FileStorage;
  jobApplication: JobApplication;
  profileReadiness: ProfileReadiness;
}): Promise<JobApplicationDetail> {
  const { jobApplications, jobApplication, profileReadiness, storage } = input;
  const [documents, events, contacts, followUps, scrapeBundle, matchAnalysis, documentContent] =
    await Promise.all([
      jobApplications.listGeneratedDocuments(jobApplication.id),
      jobApplications.listEvents(jobApplication.id),
      jobApplications.listContacts(jobApplication.id),
      jobApplications.listFollowUps(jobApplication.id),
      jobApplications.getScrapeBundle(jobApplication.id),
      jobApplications.getMatchAnalysis(jobApplication.id),
      jobApplications.getDocumentContent(jobApplication.id),
    ]);
  const companyLogoUrl = await getCompanyLogoUrl(jobApplications, storage, jobApplication.id);

  return {
    ...jobApplication,
    documents,
    events,
    contacts,
    followUps,
    scrapeBundle: toPublicScrapeBundle(scrapeBundle),
    matchAnalysis,
    documentContent,
    profileReadiness,
    ...(companyLogoUrl ? { companyLogoUrl } : {}),
  };
}

export async function addDocumentsToJobApplications(
  jobApplications: JobApplicationRepository,
  storage: FileStorage,
  jobs: JobApplication[],
): Promise<JobApplicationWithDocuments[]> {
  return Promise.all(
    jobs.map(async (jobApplication) => {
      const [documents, companyLogoUrl, matchAnalysis, scrapeBundle] = await Promise.all([
        jobApplications.listGeneratedDocuments(jobApplication.id),
        getCompanyLogoUrl(jobApplications, storage, jobApplication.id),
        jobApplications.getMatchAnalysis(jobApplication.id),
        jobApplications.getScrapeBundle(jobApplication.id),
      ]);

      return {
        ...jobApplication,
        tracking: {
          ...jobApplication.tracking,
          ...(jobApplication.tracking.roleType || !scrapeBundle?.job.location
            ? {}
            : { roleType: scrapeBundle.job.location }),
        },
        documents,
        ...(companyLogoUrl ? { companyLogoUrl } : {}),
        ...(matchAnalysis ? { matchScore: matchAnalysis.matchScore } : {}),
      };
    }),
  );
}

async function getCompanyLogoUrl(
  jobApplications: JobApplicationRepository,
  storage: FileStorage,
  jobApplicationId: string,
): Promise<string | undefined> {
  try {
    const fileId = await jobApplications.getCompanyLogoFileId(jobApplicationId);
    return fileId ? await storage.getSignedUrl(fileId) : undefined;
  } catch {
    return undefined;
  }
}

function toPublicScrapeBundle(scrape: ScrapeBundle | null): ScrapeBundle | null {
  if (!scrape) return null;
  return {
    ...scrape,
    companyManual: withoutInternalLogoFields(scrape.companyManual),
    companyLinkedIn: withoutInternalLogoFields(scrape.companyLinkedIn),
    companyWebsite: withoutInternalLogoFields(scrape.companyWebsite),
    careerPage: withoutInternalLogoFields(scrape.careerPage),
  };
}

function withoutInternalLogoFields(
  company: ScrapeBundle["companyManual"],
): ScrapeBundle["companyManual"] {
  if (!company) return undefined;
  const publicCompany = { ...company };
  delete publicCompany.logoFileId;
  delete publicCompany.logoUrl;
  return publicCompany;
}
