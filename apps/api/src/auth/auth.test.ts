import { describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import type { EmailSender } from "@careerden/domain";
import type { OtpRateLimiter } from "./otp-rate-limiter.js";
import {
  createAuth,
  createAuthHooks,
  createMonthlyCreditProvisioningHooks,
  createPasswordResetHandler,
  createVerificationOtpHandler,
} from "./auth.js";

vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({
    api: { getSession: vi.fn() },
    handler: vi.fn(),
  })),
}));

describe("createAuth", () => {
  it("requests an email verification OTP automatically after signup", () => {
    createAuth({
      baseUrl: "http://localhost:3000",
      creditProvisioner: { execute: vi.fn(async () => undefined) },
      databaseUrl: "postgres://localhost/careerden",
      emailSender: createEmailSender(),
      secret: "test-auth-secret-with-enough-length",
      trustedOrigins: ["http://localhost:5173"],
      rateLimitEnabled: true,
      trustedProxies: [],
    });

    expect(vi.mocked(betterAuth)).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerification: expect.objectContaining({ sendOnSignUp: true }),
      }),
    );
  });

  it("stores rate limits in the database and resolves client IPs through trusted proxies", () => {
    createAuth({
      baseUrl: "http://localhost:3000",
      creditProvisioner: { execute: vi.fn(async () => undefined) },
      databaseUrl: "postgres://localhost/careerden",
      emailSender: createEmailSender(),
      secret: "test-auth-secret-with-enough-length",
      trustedOrigins: ["http://localhost:5173"],
      rateLimitEnabled: true,
      trustedProxies: ["10.0.0.0/8"],
    });

    expect(vi.mocked(betterAuth)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rateLimit: { enabled: true, storage: "database" },
        advanced: { ipAddress: { trustedProxies: ["10.0.0.0/8"] } },
      }),
    );
  });
});

describe("createMonthlyCreditProvisioningHooks", () => {
  it("provisions credits after user registration and session creation", async () => {
    const creditProvisioner = { execute: vi.fn(async () => undefined) };
    const hooks = createMonthlyCreditProvisioningHooks(creditProvisioner);

    await hooks.user.create.after({ id: "user-1" });
    await hooks.session.create.after({ userId: "user-1" });

    expect(creditProvisioner.execute).toHaveBeenNthCalledWith(1, "user-1");
    expect(creditProvisioner.execute).toHaveBeenNthCalledWith(2, "user-1");
  });

  it("does not fail registration or login when provisioning needs lazy recovery", async () => {
    const creditProvisioner = {
      execute: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    };
    const logFailure = vi.fn();
    const hooks = createMonthlyCreditProvisioningHooks(creditProvisioner, logFailure);

    await expect(hooks.user.create.after({ id: "user-1" })).resolves.toBeUndefined();
    await expect(hooks.session.create.after({ userId: "user-1" })).resolves.toBeUndefined();
    expect(logFailure).toHaveBeenCalledWith({
      event: "user.created",
      errorName: "Error",
    });
    expect(logFailure).toHaveBeenCalledWith({
      event: "session.created",
      errorName: "Error",
    });
  });
});

describe("createVerificationOtpHandler", () => {
  it("sends email verification OTPs", async () => {
    const emailSender = createEmailSender();
    const sendVerificationOTP = createVerificationOtpHandler(emailSender);

    await sendVerificationOTP({
      email: "ada@example.com",
      otp: "123456",
      type: "email-verification",
    });

    expect(emailSender.send).toHaveBeenCalledWith({
      to: "ada@example.com",
      subject: "Your Careerden verification code",
      text: "Your Careerden verification code is 123456. It expires in 5 minutes.",
      html: "<p>Your Careerden verification code is <strong>123456</strong>.</p><p>It expires in 5 minutes.</p>",
    });
  });

  it("sends email-change OTPs to the new address", async () => {
    const emailSender = createEmailSender();
    const sendVerificationOTP = createVerificationOtpHandler(emailSender);

    await sendVerificationOTP({
      email: "new@example.com",
      otp: "654321",
      type: "change-email",
    });

    expect(emailSender.send).toHaveBeenCalledWith({
      to: "new@example.com",
      subject: "Confirm your new Careerden email",
      text: "Your Careerden email change code is 654321. It expires in 5 minutes. If you did not request this change, you can ignore this email.",
      html: "<p>Your Careerden email change code is <strong>654321</strong>.</p><p>It expires in 5 minutes. If you did not request this change, you can ignore this email.</p>",
    });
  });

  it("counts automatic sign-up and sign-in sends against the per-email limit", async () => {
    const emailSender = createEmailSender();
    const limiter = createOtpRateLimiter({ allowed: false, retryAfterSeconds: 90 });
    const sendVerificationOTP = createVerificationOtpHandler(emailSender, limiter);

    await sendVerificationOTP(
      { email: "ada@example.com", otp: "123456", type: "email-verification" },
      { request: new Request("http://localhost:3000/auth/sign-in/email") },
    );

    expect(limiter.consume).toHaveBeenCalledWith("ada@example.com", "send");
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("does not count direct resend requests twice", async () => {
    const emailSender = createEmailSender();
    const limiter = createOtpRateLimiter();
    const sendVerificationOTP = createVerificationOtpHandler(emailSender, limiter);

    await sendVerificationOTP(
      { email: "ada@example.com", otp: "123456", type: "email-verification" },
      { request: new Request("http://localhost:3000/auth/email-otp/send-verification-otp") },
    );

    expect(limiter.consume).not.toHaveBeenCalled();
    expect(emailSender.send).toHaveBeenCalledOnce();
  });

  it("does not send OTP emails for unsupported flows", async () => {
    const emailSender = createEmailSender();
    const sendVerificationOTP = createVerificationOtpHandler(emailSender);

    await sendVerificationOTP({ email: "ada@example.com", otp: "123456", type: "sign-in" });
    await sendVerificationOTP({
      email: "ada@example.com",
      otp: "123456",
      type: "forget-password",
    });
    expect(emailSender.send).not.toHaveBeenCalled();
  });
});

describe("createAuthHooks email change", () => {
  it("requires the current credential password before requesting an OTP", async () => {
    const verify = vi.fn(async () => true);
    const hooks = createAuthHooks({ otpRateLimiter: createOtpRateLimiter() });

    await hooks.before(
      createEmailChangeHookContext({
        body: { currentPassword: "correct-password", newEmail: "new@example.com" },
        passwordVerify: verify,
        path: "/email-otp/request-email-change",
      }),
    );

    expect(verify).toHaveBeenCalledWith({
      hash: "stored-password-hash",
      password: "correct-password",
    });
  });

  it("rejects an incorrect current password", async () => {
    const hooks = createAuthHooks({ otpRateLimiter: createOtpRateLimiter() });

    await expect(
      hooks.before(
        createEmailChangeHookContext({
          body: { currentPassword: "wrong-password", newEmail: "new@example.com" },
          passwordVerify: vi.fn(async () => false),
          path: "/email-otp/request-email-change",
        }),
      ),
    ).rejects.toMatchObject({
      body: {
        code: "INVALID_PASSWORD",
        message: "Current password is incorrect",
      },
    });
  });

  it("revokes every active session except the email-changing session", async () => {
    const deleteSession = vi.fn(async () => undefined);
    const hooks = createAuthHooks({ otpRateLimiter: createOtpRateLimiter() });

    const result = await hooks.after(
      createEmailChangeHookContext({
        deleteSession,
        path: "/email-otp/change-email",
        returned: { success: true },
        sessions: [
          { token: "current-session" },
          { token: "other-session-1" },
          { token: "other-session-2" },
        ],
      }),
    );

    expect(deleteSession).toHaveBeenCalledTimes(2);
    expect(deleteSession).toHaveBeenCalledWith("other-session-1");
    expect(deleteSession).toHaveBeenCalledWith("other-session-2");
    expect(result).toEqual({ success: true, otherSessionsRevoked: true });
  });

  it("reports a redacted partial success when other sessions cannot be revoked", async () => {
    const logFailure = vi.fn();
    const hooks = createAuthHooks({
      otpRateLimiter: createOtpRateLimiter(),
      logRevocationFailure: logFailure,
    });

    const result = await hooks.after(
      createEmailChangeHookContext({
        deleteSession: vi.fn(async () => {
          throw new Error("database details must stay private");
        }),
        path: "/email-otp/change-email",
        returned: { success: true },
        sessions: [{ token: "current-session" }, { token: "other-session" }],
      }),
    );

    expect(result).toEqual({ success: true, otherSessionsRevoked: false });
    expect(logFailure).toHaveBeenCalledWith({
      event: "email-change.other-sessions-revocation",
      errorName: "Error",
    });
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain("database details");
  });
});

describe("createAuthHooks OTP rate limiting", () => {
  it.each([
    ["/email-otp/send-verification-otp", { email: "ada@example.com" }, "send"],
    ["/email-otp/verify-email", { email: "ada@example.com", otp: "000000" }, "verify"],
    ["/email-otp/check-verification-otp", { email: "ada@example.com", otp: "000000" }, "verify"],
    ["/email-otp/change-email", { newEmail: "ada@example.com", otp: "000000" }, "verify"],
  ] as const)("counts %s per email", async (path, body, action) => {
    const otpRateLimiter = createOtpRateLimiter();
    const hooks = createAuthHooks({ otpRateLimiter });

    await hooks.before(createEmailChangeHookContext({ body, path }));

    expect(otpRateLimiter.consume).toHaveBeenCalledWith("ada@example.com", action);
  });

  it("counts email-change code requests against the new email after the password check", async () => {
    const otpRateLimiter = createOtpRateLimiter();
    const hooks = createAuthHooks({ otpRateLimiter });

    await hooks.before(
      createEmailChangeHookContext({
        body: { currentPassword: "correct-password", newEmail: "new@example.com" },
        path: "/email-otp/request-email-change",
      }),
    );

    expect(otpRateLimiter.consume).toHaveBeenCalledWith("new@example.com", "send");
  });

  it("rejects limited requests with 429 and a retry delay", async () => {
    const hooks = createAuthHooks({
      otpRateLimiter: createOtpRateLimiter({ allowed: false, retryAfterSeconds: 75 }),
    });

    const error = await hooks
      .before(
        createEmailChangeHookContext({
          body: { email: "ada@example.com", otp: "000000" },
          path: "/email-otp/verify-email",
        }),
      )
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      statusCode: 429,
      body: { code: "OTP_RATE_LIMITED", retryAfterSeconds: 75 },
      headers: { "X-Retry-After": "75" },
    });
  });

  it("resets the verify counter after a successful verification", async () => {
    const otpRateLimiter = createOtpRateLimiter();
    const hooks = createAuthHooks({ otpRateLimiter });

    await hooks.after(
      createEmailChangeHookContext({
        body: { email: "ada@example.com", otp: "123456" },
        path: "/email-otp/verify-email",
        returned: { status: true },
      }),
    );

    expect(otpRateLimiter.reset).toHaveBeenCalledWith("ada@example.com", "verify");
  });

  it("keeps the verify counter after a failed verification", async () => {
    const otpRateLimiter = createOtpRateLimiter();
    const hooks = createAuthHooks({ otpRateLimiter });

    await hooks.after(
      createEmailChangeHookContext({
        body: { email: "ada@example.com", otp: "000000" },
        path: "/email-otp/verify-email",
        returned: new Error("Invalid OTP"),
      }),
    );

    expect(otpRateLimiter.reset).not.toHaveBeenCalled();
  });

  it("ignores unrelated auth paths and disabled limits", async () => {
    const otpRateLimiter = createOtpRateLimiter();

    await createAuthHooks({ otpRateLimiter }).before(
      createEmailChangeHookContext({ body: { email: "ada@example.com" }, path: "/sign-in/email" }),
    );
    await createAuthHooks({ otpRateLimiter, otpRateLimitEnabled: false }).before(
      createEmailChangeHookContext({
        body: { email: "ada@example.com", otp: "000000" },
        path: "/email-otp/verify-email",
      }),
    );

    expect(otpRateLimiter.consume).not.toHaveBeenCalled();
  });
});

describe("createPasswordResetHandler", () => {
  it("dispatches the Better Auth reset URL without awaiting email delivery", () => {
    const emailSender = createEmailSender();
    const sendResetPassword = createPasswordResetHandler(emailSender);

    void sendResetPassword({
      user: { email: "ada@example.com" },
      url: "http://localhost:3000/auth/reset-password/token",
    });

    expect(emailSender.send).toHaveBeenCalledWith({
      to: "ada@example.com",
      subject: "Reset your Careerden password",
      text: "Reset your Careerden password by opening this link: http://localhost:3000/auth/reset-password/token\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.",
      html: '<p>We received a request to reset your Careerden password.</p><p><a href="http://localhost:3000/auth/reset-password/token">Reset your password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>',
    });
  });
});

function createEmailSender(): EmailSender {
  return {
    send: vi.fn(async () => undefined),
  };
}

function createOtpRateLimiter(
  decision = { allowed: true, retryAfterSeconds: 0 },
): OtpRateLimiter & {
  consume: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
} {
  return {
    consume: vi.fn(async () => decision),
    reset: vi.fn(async () => undefined),
  };
}

function createEmailChangeHookContext({
  body = {},
  deleteSession = vi.fn(async () => undefined),
  passwordVerify = vi.fn(async () => true),
  path,
  returned,
  sessions = [],
}: {
  body?: Record<string, unknown>;
  deleteSession?: ReturnType<typeof vi.fn>;
  passwordVerify?: ReturnType<typeof vi.fn>;
  path: string;
  returned?: unknown;
  sessions?: Array<{ token: string }>;
}) {
  return {
    body,
    context: {
      internalAdapter: {
        deleteSession,
        findAccounts: vi.fn(async () => [
          {
            password: "stored-password-hash",
            providerId: "credential",
          },
        ]),
        listSessions: vi.fn(async () => sessions),
      },
      options: {},
      password: {
        verify: passwordVerify,
      },
      responseHeaders: new Headers(),
      returned,
      session: {
        session: {
          token: "current-session",
        },
        user: {
          id: "user-1",
        },
      },
    },
    headers: new Headers(),
    method: "POST",
    path,
    query: {},
  } as never;
}
