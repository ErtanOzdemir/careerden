import type {
  FileStorage,
  JobApplicationRepository,
  RemoteImageFetcher,
  ScrapeBundle,
} from "@link2cv/domain";

export async function storeCompanyLogo(input: {
  jobApplicationId: string;
  scrape: ScrapeBundle;
  remoteImages: RemoteImageFetcher;
  storage: FileStorage;
  jobApplications: JobApplicationRepository;
}): Promise<void> {
  const { jobApplicationId, scrape, remoteImages, storage, jobApplications } = input;
  const companyWithLogo = scrape.companyLinkedIn?.logoUrl
    ? scrape.companyLinkedIn
    : scrape.companyWebsite?.logoUrl
      ? scrape.companyWebsite
      : scrape.careerPage?.logoUrl
        ? scrape.careerPage
        : undefined;

  if (!companyWithLogo?.logoUrl) return;

  try {
    const image = await remoteImages.fetch(companyWithLogo.logoUrl);
    const stored = await storage.put({
      fileName: `company-logo.${extensionForContentType(image.contentType)}`,
      contentType: image.contentType,
      body: image.body,
      metadata: { jobApplicationId, kind: "company_logo", companyName: companyWithLogo.name },
    });
    const updatedCompany = { ...companyWithLogo, logoFileId: stored.id };
    await jobApplications.saveScrapeBundle(jobApplicationId, {
      ...scrape,
      companyLinkedIn:
        scrape.companyLinkedIn === companyWithLogo ? updatedCompany : scrape.companyLinkedIn,
      companyWebsite:
        scrape.companyWebsite === companyWithLogo ? updatedCompany : scrape.companyWebsite,
      careerPage: scrape.careerPage === companyWithLogo ? updatedCompany : scrape.careerPage,
    });
  } catch {
    // Logo download is optional and must not fail scrape submission.
  }
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}
