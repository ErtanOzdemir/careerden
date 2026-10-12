import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import pg from "pg";
import type { EmailSender } from "@careerden/domain";
import { PostgresOtpRateLimiter, type OtpRateLimiter } from "./otp-rate-limiter.js";

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
  rateLimitEnabled: boolean;
  trustedProxies: string[];
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

const otpExpiresInSeconds = 5 * 60;
const otpAllowedAttemptsPerCode = 3;

/** Endpoints that create and email a new OTP; limited per destination email before the code is stored. */
const otpSendPaths: Record<string, string> = {
  "/email-otp/send-verification-otp": "email",
  "/email-otp/request-email-change": "newEmail",
};

/** Endpoints that check a submitted OTP; limited per email across every code issued to it. */
const otpVerifyPaths: Record<string, string> = {
  "/email-otp/verify-email": "email",
  "/email-otp/check-verification-otp": "email",
  "/email-otp/change-email": "newEmail",
};

export function createAuth(config: AuthConfig): CareerdenAuth {
  const database = new pg.Pool({
    connectionString: config.databaseUrl,
    // Better Auth's database rate limiter does arithmetic on the bigint `rateLimit.lastRequest`
    // column; node-postgres returns int8 as a string by default, which breaks Retry-After values.
    types: {
      getTypeParser: (oid: number, format?: "text" | "binary") =>
        oid === pg.types.builtins.INT8
          ? (value: string) => Number(value)
          : pg.types.getTypeParser(oid, format),
    },
  });
  const otpRateLimiter = new PostgresOtpRateLimiter(database);

  return betterAuth({
    baseURL: config.baseUrl,
    basePath: "/auth",
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database,
    databaseHooks: createMonthlyCreditProvisioningHooks(config.creditProvisioner),
    hooks: createAuthHooks({ otpRateLimiter, otpRateLimitEnabled: config.rateLimitEnabled }),
    rateLimit: {
      enabled: config.rateLimitEnabled,
      storage: "database",
    },
    advanced: {
      ipAddress: {
        trustedProxies: config.trustedProxies,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: createPasswordResetHandler(config.emailSender),
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      sendOnSignIn: true,
    },
    plugins: [
      emailOTP({
        allowedAttempts: otpAllowedAttemptsPerCode,
        expiresIn: otpExpiresInSeconds,
        changeEmail: {
          enabled: true,
          verifyCurrentEmail: false,
        },
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: createVerificationOtpHandler(
          config.emailSender,
          config.rateLimitEnabled ? otpRateLimiter : undefined,
        ),
      }),
    ],
  });
}

export interface AuthHooksOptions {
  otpRateLimiter: OtpRateLimiter;
  otpRateLimitEnabled?: boolean;
  logRevocationFailure?: AuthEmailChangeSessionRevocationFailureLogger;
}

type AuthHookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

export function createAuthHooks({
  otpRateLimiter,
  otpRateLimitEnabled = true,
  logRevocationFailure = defaultEmailChangeSessionRevocationFailureLogger,
}: AuthHooksOptions) {
  return {
    before: createAuthMiddleware(async (context) => {
      await requireCurrentPasswordForEmailChange(context);
      if (otpRateLimitEnabled) {
        await enforceOtpRateLimit(context, otpRateLimiter);
      }
    }),
    after: createAuthMiddleware(async (context) => {
      if (otpRateLimitEnabled) {
        await resetOtpVerifyLimitAfterSuccess(context, otpRateLimiter);
      }
      return revokeOtherSessionsAfterEmailChange(context, logRevocationFailure);
    }),
  };
}

async function requireCurrentPasswordForEmailChange(context: AuthHookContext): Promise<void> {
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
}

async function revokeOtherSessionsAfterEmailChange(
  context: AuthHookContext,
  logRevocationFailure: AuthEmailChangeSessionRevocationFailureLogger,
) {
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
}

async function enforceOtpRateLimit(
  context: AuthHookContext,
  otpRateLimiter: OtpRateLimiter,
): Promise<void> {
  const path = context.path ?? "";
  const sendEmailField = otpSendPaths[path];
  const verifyEmailField = otpVerifyPaths[path];
  const action = sendEmailField ? "send" : verifyEmailField ? "verify" : undefined;
  const emailField = sendEmailField ?? verifyEmailField;
  if (!action || !emailField) return;

  const email = getStringField(context.body, emailField);
  if (!email) return;

  const decision = await otpRateLimiter.consume(email, action);
  if (!decision.allowed) {
    throw createOtpRateLimitedError(decision.retryAfterSeconds);
  }
}

async function resetOtpVerifyLimitAfterSuccess(
  context: AuthHookContext,
  otpRateLimiter: OtpRateLimiter,
): Promise<void> {
  const path = context.path ?? "";
  const emailField = otpVerifyPaths[path];
  if (!emailField || !isSuccessfulOtpVerification(context.context.returned)) return;

  const email = getStringField(context.body, emailField);
  if (email) {
    await otpRateLimiter.reset(email, "verify");
  }
}

function createOtpRateLimitedError(retryAfterSeconds: number): APIError {
  return new APIError(
    "TOO_MANY_REQUESTS",
    {
      code: "OTP_RATE_LIMITED",
      message: "Too many verification code attempts. Please try again later.",
      retryAfterSeconds,
    },
    { "X-Retry-After": String(retryAfterSeconds) },
  );
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

export function createVerificationOtpHandler(
  emailSender: EmailSender,
  otpRateLimiter?: OtpRateLimiter,
) {
  return async function sendVerificationOTP(
    { email, otp, type }: VerificationOtpInput,
    context?: { request?: Request },
  ) {
    // Sign-up and sign-in send codes through an internal call that bypasses auth hooks, so count
    // them here; direct requests to the send endpoints were already counted by the before hook.
    // Skip delivery (rather than fail sign-in) once this email is limited.
    if (otpRateLimiter && !wasOtpSendCountedByHook(context?.request)) {
      const decision = await otpRateLimiter.consume(email, "send");
      if (!decision.allowed) return;
    }

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

function wasOtpSendCountedByHook(request: Request | undefined): boolean {
  if (!request) return false;
  const pathname = new URL(request.url).pathname;
  return Object.keys(otpSendPaths).some((path) => pathname.endsWith(path));
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

function isSuccessfulOtpVerification(value: unknown): boolean {
  if (!value || typeof value !== "object" || value instanceof Error) return false;
  const status = (value as Record<string, unknown>).status;
  return status === true || isSuccessfulEmailChange(value);
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
