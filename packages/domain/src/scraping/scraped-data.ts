export interface ScrapedJob {
  title: string;
  companyName: string;
  location?: string;
  description: string;
  requirements: string[];
  companyLinkedInUrl?: string;
  raw: unknown;
}

export interface CompanyLookupInput {
  companyName: string;
  linkedInUrl?: string;
  websiteUrl?: string;
}

export interface ScrapedCompany {
  name: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  careerPageUrl?: string;
  description?: string;
  raw: unknown;
}

export interface ScrapeBundle {
  job: ScrapedJob;
  companyLinkedIn?: ScrapedCompany;
  companyWebsite?: ScrapedCompany;
  careerPage?: ScrapedCompany;
}
