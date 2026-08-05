import { describe, expect, it, vi } from "vitest";
import { createResendEmailSender } from "./resend-email.sender.js";

describe("createResendEmailSender", () => {
  it("sends generic email messages through Resend", async () => {
    const send = vi.fn(async () => ({ data: { id: "email-1" }, error: null }));
    const sender = createResendEmailSender(
      {
        apiKey: "re_test",
        from: "Careerden <no-reply@email.careerden.com>",
      },
      { emails: { send } } as never,
    );

    await sender.send({
      to: "ada@example.com",
      subject: "Welcome",
      text: "Welcome to Careerden.",
      html: "<p>Welcome to Careerden.</p>",
    });

    expect(send).toHaveBeenCalledWith(
      {
        from: "Careerden <no-reply@email.careerden.com>",
        to: "ada@example.com",
        subject: "Welcome",
        text: "Welcome to Careerden.",
        html: "<p>Welcome to Careerden.</p>",
      },
      undefined,
    );
  });

  it("uses the persisted message ID as the Resend idempotency key", async () => {
    const send = vi.fn(async () => ({ data: { id: "email-1" }, error: null }));
    const sender = createResendEmailSender(
      { apiKey: "re_test", from: "no-reply@email.careerden.com" },
      { emails: { send } } as never,
    );

    await sender.send({
      messageId: "<follow-up-1@careerden.local>",
      to: "ada@example.com",
      subject: "Reminder",
      text: "Remember to follow up.",
    });

    expect(send).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "<follow-up-1@careerden.local>",
    });
  });

  it("rejects Resend API errors without exposing message content", async () => {
    const send = vi.fn(async () => ({
      data: null,
      error: { name: "rate_limit_exceeded", message: "provider details", statusCode: 429 },
    }));
    const sender = createResendEmailSender(
      { apiKey: "re_test", from: "no-reply@email.careerden.com" },
      { emails: { send } } as never,
    );

    const delivery = sender.send({
      to: "ada@example.com",
      subject: "Sensitive subject",
      text: "Sensitive body",
    });

    await expect(delivery).rejects.toThrow("Resend email delivery failed: rate_limit_exceeded");
    await expect(delivery).rejects.not.toThrow("Sensitive body");
    await expect(delivery).rejects.toMatchObject({
      code: "rate_limit_exceeded",
      retryable: true,
    });
  });

  it("classifies permanent provider rejections as non-retryable", async () => {
    const sender = createResendEmailSender(
      { apiKey: "re_test", from: "no-reply@email.careerden.com" },
      {
        emails: {
          send: vi.fn(async () => ({
            data: null,
            error: {
              name: "invalid_from_address",
              message: "provider details",
              statusCode: 422,
            },
          })),
        },
      } as never,
    );

    await expect(
      sender.send({
        to: "ada@example.com",
        subject: "Reminder",
        text: "Remember to follow up.",
      }),
    ).rejects.toMatchObject({
      code: "invalid_from_address",
      retryable: false,
    });
  });

  it("preserves thrown transport errors for the caller's retry policy", async () => {
    const transportError = new Error("network unavailable");
    const send = vi.fn(async () => {
      throw transportError;
    });
    const sender = createResendEmailSender(
      { apiKey: "re_test", from: "no-reply@email.careerden.com" },
      { emails: { send } } as never,
    );

    await expect(
      sender.send({
        to: "ada@example.com",
        subject: "Welcome",
        text: "Welcome to Careerden.",
      }),
    ).rejects.toBe(transportError);
  });
});
