import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from "better-auth/api";
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
  creditProvisioner: AuthCreditProvisioner;
  baseUrl: string;
  databaseUrl: string;
  secret: string;
  trustedOrigins: string[];
}

export interface AuthCreditProvisioner {
  execute(userId: string): Promise<unknown>;
}

export interface AuthCreditProvisioningFailure {
  errorName: string;
  event: "session.created" | "user.created";
}

export type AuthCreditProvisioningFailureLogger = (failure: AuthCreditProvisioningFailure) => void;

export interface AuthEmailChangeSessionRevocationFailure {
  errorName: string;
  event: "email-change.other-sessions-revocation";
}

export type AuthEmailChangeSessionRevocationFailureLogger = (
  failure: AuthEmailChangeSessionRevocationFailure,
) => void;

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
    databaseHooks: createMonthlyCreditProvisioningHooks(config.creditProvisioner),
    hooks: createEmailChangeHooks(),
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
        changeEmail: {
          enabled: true,
          verifyCurrentEmail: false,
        },
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: createVerificationOtpHandler(config.emailSender),
      }),
    ],
  });
}

export function createEmailChangeHooks(
  logRevocationFailure: AuthEmailChangeSessionRevocationFailureLogger = defaultEmailChangeSessionRevocationFailureLogger,
) {
  return {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/email-otp/request-email-change") {
        return;
      }

      const session = await getAuthoritativeSessionFromCtx(context);
      if (!session) {
        throw new APIError("UNAUTHORIZED", {
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        });
      }

      const currentPassword = getStringField(context.body, "currentPassword");
      const credentialAccount = (
        await context.context.internalAdapter.findAccounts(session.user.id)
      ).find((account) => account.providerId === "credential");
      const isPasswordValid =
        Boolean(currentPassword) &&
        Boolean(credentialAccount?.password) &&
        (await context.context.password.verify({
          hash: credentialAccount?.password ?? "",
          password: currentPassword ?? "",
        }));

      if (!isPasswordValid) {
        throw new APIError("BAD_REQUEST", {
          code: "INVALID_PASSWORD",
          message: "Current password is incorrect",
        });
      }
    }),
    after: createAuthMiddleware(async (context) => {
      if (
        context.path !== "/email-otp/change-email" ||
        !isSuccessfulEmailChange(context.context.returned)
      ) {
        return;
      }

      try {
        const session = await getAuthoritativeSessionFromCtx(context);
        if (!session) {
          throw new Error("EmailChangeSessionMissing");
        }

        const otherSessions = (
          await context.context.internalAdapter.listSessions(session.user.id, {
            onlyActiveSessions: true,
          })
        ).filter((candidate) => candidate.token !== session.session.token);

        await Promise.all(
          otherSessions.map((candidate) =>
            context.context.internalAdapter.deleteSession(candidate.token),
          ),
        );

        return { success: true, otherSessionsRevoked: true };
      } catch (error) {
        logRevocationFailure({
          event: "email-change.other-sessions-revocation",
          errorName: error instanceof Error ? error.name : "NonErrorThrown",
        });
        return { success: true, otherSessionsRevoked: false };
      }
    }),
  };
}

export function createMonthlyCreditProvisioningHooks(
  creditProvisioner: AuthCreditProvisioner,
  logFailure: AuthCreditProvisioningFailureLogger = defaultCreditProvisioningFailureLogger,
) {
  const provision = async (
    userId: string,
    event: AuthCreditProvisioningFailure["event"],
  ): Promise<void> => {
    try {
      await creditProvisioner.execute(userId);
    } catch (error) {
      logFailure({
        event,
        errorName: error instanceof Error ? error.name : "NonErrorThrown",
      });
    }
  };

  return {
    user: {
      create: {
        after: async (user: { id: string }) => provision(user.id, "user.created"),
      },
    },
    session: {
      create: {
        after: async (session: { userId: string }) => provision(session.userId, "session.created"),
      },
    },
  };
}

function defaultCreditProvisioningFailureLogger(failure: AuthCreditProvisioningFailure): void {
  console.error("Failed to provision monthly credits from auth lifecycle", failure);
}

export function createVerificationOtpHandler(emailSender: EmailSender) {
  return async function sendVerificationOTP({ email, otp, type }: VerificationOtpInput) {
    if (type === "change-email") {
      await emailSender.send({
        to: email,
        subject: "Confirm your new Careerden email",
        text: `Your Careerden email change code is ${otp}. It expires in 5 minutes. If you did not request this change, you can ignore this email.`,
        html: `<p>Your Careerden email change code is <strong>${escapeHtml(otp)}</strong>.</p><p>It expires in 5 minutes. If you did not request this change, you can ignore this email.</p>`,
      });
      return;
    }

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

function defaultEmailChangeSessionRevocationFailureLogger(
  failure: AuthEmailChangeSessionRevocationFailure,
): void {
  console.error("Failed to revoke other sessions after account email change", failure);
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

function isSuccessfulEmailChange(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Record<string, unknown>).success === true
  );
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
