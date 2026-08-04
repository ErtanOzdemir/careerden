import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "@careerden/domain";
import {
  createEmailChangeHooks,
  createMonthlyCreditProvisioningHooks,
  createPasswordResetHandler,
  createVerificationOtpHandler,
} from "./auth.js";

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

describe("createEmailChangeHooks", () => {
  it("requires the current credential password before requesting an OTP", async () => {
    const verify = vi.fn(async () => true);
    const hooks = createEmailChangeHooks();

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
    const hooks = createEmailChangeHooks();

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
    const hooks = createEmailChangeHooks();

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
    const hooks = createEmailChangeHooks(logFailure);

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
