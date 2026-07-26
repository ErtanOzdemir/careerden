import type { FileStorage, RemoteImageFetcher, ScrapeBundle } from "@careerden/domain";

export async function storeCompanyLogo(input: {
  jobApplicationId: string;
  scrape: ScrapeBundle;
  remoteImages: RemoteImageFetcher;
  storage: FileStorage;
}): Promise<{ scrape: ScrapeBundle; uploadedFileId?: string }> {
  const { jobApplicationId, scrape, remoteImages, storage } = input;
  const companyWithLogo = scrape.companyManual?.logoUrl
    ? scrape.companyManual
    : scrape.companyLinkedIn?.logoUrl
      ? scrape.companyLinkedIn
      : scrape.companyWebsite?.logoUrl
        ? scrape.companyWebsite
        : scrape.careerPage?.logoUrl
          ? scrape.careerPage
          : undefined;

  if (!companyWithLogo?.logoUrl) return { scrape };

  try {
    const image = await remoteImages.fetch(companyWithLogo.logoUrl);
    const fileName = `company-logo.${extensionForContentType(image.contentType)}`;
    const stored = await storage.put({
      key: `job-applications/${jobApplicationId}/company-logo/${fileName}`,
      fileName,
      contentType: image.contentType,
      body: image.body,
      metadata: { jobApplicationId, kind: "company_logo", companyName: companyWithLogo.name },
    });
    const updatedCompany = { ...companyWithLogo, logoFileId: stored.id };
    return {
      uploadedFileId: stored.id,
      scrape: {
        ...scrape,
        companyManual:
          scrape.companyManual === companyWithLogo ? updatedCompany : scrape.companyManual,
        companyLinkedIn:
          scrape.companyLinkedIn === companyWithLogo ? updatedCompany : scrape.companyLinkedIn,
        companyWebsite:
          scrape.companyWebsite === companyWithLogo ? updatedCompany : scrape.companyWebsite,
        careerPage: scrape.careerPage === companyWithLogo ? updatedCompany : scrape.careerPage,
      },
    };
  } catch {
    // Logo download is optional and must not fail scrape submission.
    return { scrape };
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
