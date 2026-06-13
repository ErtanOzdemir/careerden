import { z } from "zod";

export const linkedInJobUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.hostname.endsWith("linkedin.com") && url.pathname.includes("/jobs/");
  }, "Expected a LinkedIn job URL");

export const createJobApplicationSchema = z.object({
  profileId: z.string().min(1),
  sourceUrl: linkedInJobUrlSchema
});

export type CreateJobApplicationDto = z.infer<typeof createJobApplicationSchema>;
