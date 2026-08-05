import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateProductionResendEmailEnv } from "./production-secrets.js";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    EMAIL_FROM: z.string(),
    RESEND_API_KEY: z.string().optional(),
    emailRequired: z.boolean().optional(),
  })
  .superRefine(validateProductionResendEmailEnv);

describe("production Resend email environment", () => {
  it("allows local SMTP defaults outside production", () => {
    expect(
      schema.parse({
        NODE_ENV: "development",
        EMAIL_FROM: "Careerden <no-reply@careerden.local>",
      }),
    ).toMatchObject({ NODE_ENV: "development" });
  });

  it("requires a Resend API key in production", () => {
    const result = schema.safeParse({
      NODE_ENV: "production",
      EMAIL_FROM: "Careerden <no-reply@email.careerden.com>",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ["RESEND_API_KEY"] })]),
      );
    }
  });

  it.each([
    "not-an-email",
    "Careerden <no-reply@careerden.local>",
    "Careerden <no-reply@mail.localhost>",
  ])("rejects invalid or local production sender %s", (emailFrom) => {
    const result = schema.safeParse({
      NODE_ENV: "production",
      EMAIL_FROM: emailFrom,
      RESEND_API_KEY: "re_production",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ["EMAIL_FROM"] })]),
      );
    }
  });

  it("allows disabled production email without Resend configuration", () => {
    expect(
      schema.parse({
        NODE_ENV: "production",
        EMAIL_FROM: "Careerden <no-reply@careerden.local>",
        emailRequired: false,
      }),
    ).toMatchObject({ emailRequired: false });
  });

  it("accepts a configured production sender", () => {
    expect(
      schema.parse({
        NODE_ENV: "production",
        EMAIL_FROM: "Careerden <no-reply@email.careerden.com>",
        RESEND_API_KEY: "re_production",
      }),
    ).toMatchObject({ RESEND_API_KEY: "re_production" });
  });
});
