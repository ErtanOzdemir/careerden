import { z } from "zod";

export const linkedInJobUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.hostname.endsWith("linkedin.com") && url.pathname.includes("/jobs/");
  }, "Expected a LinkedIn job URL");

export const applicationStatusSchema = z.enum([
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
  "ghosted",
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
    applicationStatus: applicationStatusSchema.default("saved"),
    priority: applicationPrioritySchema.optional(),
    tags: tagsSchema,
    lastResponseAt: z.coerce.date().optional(),
    metadata: metadataSchema,
  })
  .superRefine((value, context) => {
    if (value.sourceUrl || value.jobUrl) {
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
  descriptionHtml: z.string().min(1).max(250_000).optional(),
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
  applicationStatus: applicationStatusSchema.default("saved"),
  priority: applicationPrioritySchema.optional(),
  tags: tagsSchema,
  metadata: metadataSchema,
});

export const salaryCurrencyCodes = Intl.supportedValuesOf("currency");

const salaryCurrencySchema = z
  .string()
  .refine((value) => salaryCurrencyCodes.includes(value), "Unsupported ISO 4217 currency code");
const salaryAmountSchema = z.number().finite().nonnegative();
const salaryPeriodSchema = z.enum(["hourly", "monthly", "yearly"]);
const salaryTypeSchema = z.enum(["gross", "net"]);
const workStyleSchema = z.enum(["remote", "hybrid", "on_site"]);

export const updateJobApplicationSchema = z
  .object({
    companyName: z.string().min(1).optional(),
    roleTitle: z.string().min(1).optional(),
    roleType: z.string().min(1).optional(),
    jobUrl: z.string().url().optional(),
    dateApplied: z.string().min(1).optional(),
    applicationStatus: applicationStatusSchema.optional(),
    priority: applicationPrioritySchema.nullable().optional(),
    tags: z.array(z.string().min(1)).optional(),
    lastResponseAt: z.coerce.date().nullable().optional(),
    salaryMinAmount: salaryAmountSchema.nullable().optional(),
    salaryMaxAmount: salaryAmountSchema.nullable().optional(),
    salaryCurrency: salaryCurrencySchema.nullable().optional(),
    salaryPeriod: salaryPeriodSchema.nullable().optional(),
    salaryType: salaryTypeSchema.nullable().optional(),
    workStyle: workStyleSchema.nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    const salaryKeys = [
      "salaryMinAmount",
      "salaryMaxAmount",
      "salaryCurrency",
      "salaryPeriod",
      "salaryType",
    ] as const;
    if (!salaryKeys.some((key) => key in value)) return;

    const hasMinimum = value.salaryMinAmount != null;
    const hasMaximum = value.salaryMaxAmount != null;
    const isClear = salaryKeys.every((key) => value[key] === null);
    if (isClear) return;

    if (!hasMinimum && !hasMaximum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMinAmount"],
        message: "At least one salary amount is required",
      });
    }
    if (!value.salaryCurrency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryCurrency"],
        message: "Currency is required when salary is set",
      });
    }
    if (!value.salaryPeriod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryPeriod"],
        message: "Pay period is required when salary is set",
      });
    }
    if (!value.salaryType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryType"],
        message: "Gross or net salary type is required when salary is set",
      });
    }
    if (hasMinimum && hasMaximum && value.salaryMinAmount! > value.salaryMaxAmount!) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMaxAmount"],
        message: "Maximum salary must be greater than or equal to minimum salary",
      });
    }
  });

export const createJobApplicationFollowUpSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  scheduledAt: z.coerce.date(),
});

export const updateJobApplicationFollowUpSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const jobApplicationEventTypeSchema = z.enum([
  "created",
  "status_changed",
  "note",
  "comment",
  "reminder",
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

export const listJobApplicationsQuerySchema = z.object({
  profileId: z.string().min(1),
  processingStatus: z
    .enum([
      "queued",
      "scraping",
      "scraped",
      "analyzing",
      "review_ready",
      "generating_documents",
      "completed",
      "failed",
    ])
    .optional(),
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
  claimedBy: z.string().min(1).optional(),
  scrapeBundle: scrapeBundleSchema,
  sourceUrl: z.string().url().optional(),
});

export const claimScrapeJobSchema = z.object({
  claimedBy: z.string().min(1),
});

export const failScrapeJobSchema = z.object({
  claimedBy: z.string().min(1),
  reason: z.string().min(1),
});

export const heartbeatScrapeJobSchema = z.object({
  claimedBy: z.string().min(1),
});

export const jobApplicationAnalyticsQuerySchema = z.object({
  profileId: z.string().min(1),
});

export type CreateJobApplicationDto = z.infer<typeof createJobApplicationSchema>;
export type CreateJobApplicationFromScrapeDto = z.infer<
  typeof createJobApplicationFromScrapeSchema
>;
export type UpdateJobApplicationDto = z.infer<typeof updateJobApplicationSchema>;
export type CreateJobApplicationFollowUpDto = z.infer<typeof createJobApplicationFollowUpSchema>;
export type UpdateJobApplicationFollowUpDto = z.infer<typeof updateJobApplicationFollowUpSchema>;
export type CreateJobApplicationEventDto = z.infer<typeof createJobApplicationEventSchema>;
export type CreateJobApplicationContactDto = z.infer<typeof createJobApplicationContactSchema>;
export type UpdateJobApplicationContactDto = z.infer<typeof updateJobApplicationContactSchema>;
export type ListJobApplicationsQueryDto = z.infer<typeof listJobApplicationsQuerySchema>;
export type ClaimScrapeJobDto = z.infer<typeof claimScrapeJobSchema>;
export type FailScrapeJobDto = z.infer<typeof failScrapeJobSchema>;
export type HeartbeatScrapeJobDto = z.infer<typeof heartbeatScrapeJobSchema>;
