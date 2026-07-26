export interface ScrapedJob {
  title: string;
  companyName: string;
  location?: string;
  description: string;
  descriptionHtml?: string;
  requirements: string[];
  companyLinkedInUrl?: string;
  companyLogoUrl?: string;
  raw: unknown;
}

export interface CompanyLookupInput {
  companyName: string;
  linkedInUrl?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface ScrapedCompany {
  name: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  careerPageUrl?: string;
  description?: string;
  logoUrl?: string;
  logoFileId?: string;
  raw: unknown;
}

export interface ScrapeBundle {
  job: ScrapedJob;
  companyManual?: ScrapedCompany;
  companyLinkedIn?: ScrapedCompany;
  companyWebsite?: ScrapedCompany;
  careerPage?: ScrapedCompany;
}
