import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "@careerden/domain";
import { PostgresEmailOutboxDispatcher } from "./infrastructure/persistence/postgres-email-outbox.dispatcher.js";
import { PostgresOutboxRepository } from "@careerden/infrastructure";
import { createEmailOutboxDispatcher } from "./app.js";

describe("createEmailOutboxDispatcher", () => {
  const outbox = new PostgresOutboxRepository({} as never);
  const emailSender: EmailSender = { send: vi.fn() };
  const createEmailSender = vi.fn(() => emailSender);

  it("creates email delivery when reminder email is enabled", () => {
    expect(createEmailOutboxDispatcher(true, outbox, createEmailSender)).toBeInstanceOf(
      PostgresEmailOutboxDispatcher,
    );
    expect(createEmailSender).toHaveBeenCalledOnce();
  });

  it("omits email delivery when reminder email is disabled", () => {
    createEmailSender.mockClear();

    expect(createEmailOutboxDispatcher(false, outbox, createEmailSender)).toBeUndefined();
    expect(createEmailSender).not.toHaveBeenCalled();
  });
});
