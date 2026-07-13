import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import type { AuthEmailSender } from "./auth-email-sender.js";

type VerificationOtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

interface VerificationOtpInput {
  email: string;
  otp: string;
  type: VerificationOtpType;
}

export interface AuthConfig {
  authEmailSender: AuthEmailSender;
  baseUrl: string;
  databaseUrl: string;
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
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: createPasswordResetHandler(config.authEmailSender),
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignIn: true,
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: createRegistrationOtpHandler(config.authEmailSender),
      }),
    ],
  });
}

export function createRegistrationOtpHandler(authEmailSender: AuthEmailSender) {
  return async function sendVerificationOTP({ email, otp, type }: VerificationOtpInput) {
    if (type !== "email-verification") {
      return;
    }

    await authEmailSender.sendRegistrationOtp({ email, otp });
  };
}

export function createPasswordResetHandler(authEmailSender: AuthEmailSender) {
  return async function sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
    void authEmailSender
      .sendPasswordResetLink({ email: user.email, url })
      .catch((error: unknown) => {
        console.error("Failed to send password-reset email", error);
      });
  };
}
