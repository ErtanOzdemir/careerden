import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import type { OtpEmailSender } from "./email-otp-mailer.js";

type VerificationOtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

interface VerificationOtpInput {
  email: string;
  otp: string;
  type: VerificationOtpType;
}

export interface AuthConfig {
  baseUrl: string;
  databaseUrl: string;
  otpEmailSender: OtpEmailSender;
  secret: string;
  trustedOrigins: string[];
}

export interface Link2CvAuth {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession(input: { headers: Headers }): Promise<{
      user: {
        id: string;
        email: string;
        name: string;
      };
    } | null>;
  };
}

export function createAuth(config: AuthConfig): Link2CvAuth {
  return betterAuth({
    baseURL: config.baseUrl,
    basePath: "/auth",
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: new Pool({
      connectionString: config.databaseUrl,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignIn: true,
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: createRegistrationOtpHandler(config.otpEmailSender),
      }),
    ],
  });
}

export function createRegistrationOtpHandler(otpEmailSender: OtpEmailSender) {
  return async function sendVerificationOTP({ email, otp, type }: VerificationOtpInput) {
    if (type !== "email-verification") {
      return;
    }

    await otpEmailSender.sendRegistrationOtp({ email, otp });
  };
}
