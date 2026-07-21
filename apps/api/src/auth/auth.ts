import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import type { EmailSender } from "@careerden/domain";

type VerificationOtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

interface VerificationOtpInput {
  email: string;
  otp: string;
  type: VerificationOtpType;
}

export interface AuthConfig {
  emailSender: EmailSender;
  baseUrl: string;
  databaseUrl: string;
  secret: string;
  trustedOrigins: string[];
}

export interface CareerdenAuth {
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

export function createAuth(config: AuthConfig): CareerdenAuth {
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
      sendResetPassword: createPasswordResetHandler(config.emailSender),
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignIn: true,
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: createRegistrationOtpHandler(config.emailSender),
      }),
    ],
  });
}

export function createRegistrationOtpHandler(emailSender: EmailSender) {
  return async function sendVerificationOTP({ email, otp, type }: VerificationOtpInput) {
    if (type !== "email-verification") {
      return;
    }

    await emailSender.send({
      to: email,
      subject: "Your Careerden verification code",
      text: `Your Careerden verification code is ${otp}. It expires in 5 minutes.`,
      html: `<p>Your Careerden verification code is <strong>${escapeHtml(otp)}</strong>.</p><p>It expires in 5 minutes.</p>`,
    });
  };
}

export function createPasswordResetHandler(emailSender: EmailSender) {
  return async function sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
    void emailSender
      .send({
        to: user.email,
        subject: "Reset your Careerden password",
        text: `Reset your Careerden password by opening this link: ${url}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
        html: `<p>We received a request to reset your Careerden password.</p><p><a href="${escapeHtml(url)}">Reset your password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>`,
      })
      .catch((error: unknown) => {
        console.error("Failed to send password-reset email", error);
      });
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
