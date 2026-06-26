import { z } from "zod";

export const linkedInJobUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.hostname.endsWith("linkedin.com") && url.pathname.includes("/jobs/");
  }, "Expected a LinkedIn job URL");

export const applicationStatusSchema = z.enum([
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
]);

export const applicationPrioritySchema = z.enum(["low", "medium", "high"]);

const metadataSchema = z.record(z.string(), z.unknown()).default({});
const tagsSchema = z.array(z.string().min(1)).default([]);

export const createJobApplicationSchema = z
  .object({
    profileId: z.string().min(1),
    sourceUrl: linkedInJobUrlSchema.optional(),
    companyName: z.string().min(1).optional(),
    roleTitle: z.string().min(1).optional(),
    roleType: z.string().min(1).optional(),
    jobUrl: z.string().url().optional(),
    dateApplied: z.string().min(1).optional(),
    applicationStatus: applicationStatusSchema.default("applied"),
    priority: applicationPrioritySchema.default("medium"),
    tags: tagsSchema,
    nextFollowUpAt: z.coerce.date().optional(),
    lastResponseAt: z.coerce.date().optional(),
    metadata: metadataSchema,
  })
  .superRefine((value, context) => {
    if (value.sourceUrl) {
      return;
    }

    if (!value.companyName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "companyName is required when sourceUrl is not provided",
        path: ["companyName"],
      });
    }

    if (!value.roleTitle) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "roleTitle is required when sourceUrl is not provided",
        path: ["roleTitle"],
      });
    }
  });

export const scrapedJobSchema = z.object({
  title: z.string().min(1),
  companyName: z.string().min(1),
  location: z.string().optional(),
  description: z.string().min(1),
  requirements: z.array(z.string()).default([]),
  companyLinkedInUrl: z.string().url().optional(),
  raw: z.unknown(),
});

export const scrapedCompanySchema = z.object({
  name: z.string().min(1),
  linkedInUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  careerPageUrl: z.string().url().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  logoFileId: z.string().optional(),
  raw: z.unknown(),
});

export const scrapeBundleSchema = z.object({
  job: scrapedJobSchema,
  companyLinkedIn: scrapedCompanySchema.optional(),
  companyWebsite: scrapedCompanySchema.optional(),
  careerPage: scrapedCompanySchema.optional(),
});

export const createJobApplicationFromScrapeSchema = z.object({
  sourceUrl: linkedInJobUrlSchema,
  scrapeBundle: scrapeBundleSchema,
  dateApplied: z.string().min(1).optional(),
  applicationStatus: applicationStatusSchema.default("applied"),
  priority: applicationPrioritySchema.default("medium"),
  tags: tagsSchema,
  metadata: metadataSchema,
});

export const updateJobApplicationSchema = z.object({
  companyName: z.string().min(1).optional(),
  roleTitle: z.string().min(1).optional(),
  roleType: z.string().min(1).optional(),
  jobUrl: z.string().url().optional(),
  dateApplied: z.string().min(1).optional(),
  applicationStatus: applicationStatusSchema.optional(),
  priority: applicationPrioritySchema.optional(),
  tags: z.array(z.string().min(1)).optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
  lastResponseAt: z.coerce.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const jobApplicationEventTypeSchema = z.enum([
  "created",
  "status_changed",
  "note",
  "comment",
  "reminder",
  "interview",
  "processing",
]);

export const createJobApplicationEventSchema = z.object({
  type: jobApplicationEventTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1).optional(),
  occurredAt: z.coerce.date().optional(),
  metadata: metadataSchema,
});

export const createJobApplicationContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  linkedInUrl: z.string().url().optional(),
  notes: z.string().min(1).optional(),
});

export const updateJobApplicationContactSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  linkedInUrl: z.string().url().nullable().optional(),
  notes: z.string().min(1).nullable().optional(),
});

export const jobApplicationInterviewStatusSchema = z.enum(["upcoming", "completed", "cancelled"]);

export const createJobApplicationInterviewSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1).optional(),
  scheduledAt: z.coerce.date(),
  status: jobApplicationInterviewStatusSchema.default("upcoming"),
  notes: z.string().min(1).optional(),
  prepNotes: z.string().min(1).optional(),
});

export const updateJobApplicationInterviewSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.string().min(1).nullable().optional(),
  scheduledAt: z.coerce.date().optional(),
  status: jobApplicationInterviewStatusSchema.optional(),
  notes: z.string().min(1).nullable().optional(),
  prepNotes: z.string().min(1).nullable().optional(),
});

export const listJobApplicationsQuerySchema = z.object({
  profileId: z.string().min(1),
  applicationStatus: applicationStatusSchema.optional(),
  company: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  roleType: z.string().min(1).optional(),
  priority: applicationPrioritySchema.optional(),
  tag: z.string().min(1).optional(),
  dateFrom: z.string().min(1).optional(),
  dateTo: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  sortBy: z
    .enum(["dateApplied", "companyName", "roleTitle", "applicationStatus", "updatedAt"])
    .default("updatedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const updateStatusSchema = z.object({
  status: z.enum([
    "queued",
    "scraping",
    "scraped",
    "analyzing",
    "review_ready",
    "generating_documents",
    "completed",
    "failed",
  ]),
});

export const submitScrapeDataSchema = z.object({
  scrapeBundle: scrapeBundleSchema,
  sourceUrl: z.string().url().optional(),
});

export const jobApplicationAnalyticsQuerySchema = z.object({
  profileId: z.string().min(1),
});

export type CreateJobApplicationDto = z.infer<typeof createJobApplicationSchema>;
export type CreateJobApplicationFromScrapeDto = z.infer<
  typeof createJobApplicationFromScrapeSchema
>;
export type UpdateJobApplicationDto = z.infer<typeof updateJobApplicationSchema>;
export type CreateJobApplicationEventDto = z.infer<typeof createJobApplicationEventSchema>;
export type CreateJobApplicationContactDto = z.infer<typeof createJobApplicationContactSchema>;
export type UpdateJobApplicationContactDto = z.infer<typeof updateJobApplicationContactSchema>;
export type CreateJobApplicationInterviewDto = z.infer<typeof createJobApplicationInterviewSchema>;
export type UpdateJobApplicationInterviewDto = z.infer<typeof updateJobApplicationInterviewSchema>;
export type ListJobApplicationsQueryDto = z.infer<typeof listJobApplicationsQuerySchema>;
