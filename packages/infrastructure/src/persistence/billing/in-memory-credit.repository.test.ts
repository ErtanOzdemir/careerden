import { describe, expect, it } from "vitest";
import { InMemoryCreditRepository } from "./in-memory-credit.repository.js";

describe("InMemoryCreditRepository", () => {
  it("keeps grants idempotent and calculates only currently valid balances", async () => {
    const repository = new InMemoryCreditRepository();
    const input = {
      userId: "user-1",
      sourceType: "free_monthly" as const,
      idempotencyKey: "free:user-1:2026-07",
      amount: 10,
      validFrom: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-24T14:30:00.000Z"),
    };

    await expect(repository.ensureGrant(input)).resolves.toMatchObject({ created: true });
    await expect(repository.ensureGrant(input)).resolves.toMatchObject({ created: false });
    await expect(
      repository.getBalance("user-1", new Date("2026-07-31T23:59:59.999Z")),
    ).resolves.toEqual({
      totalCredits: 10,
      availableCredits: 10,
      reservedCredits: 0,
    });
    await expect(
      repository.getBalance("user-1", new Date("2026-08-01T00:00:00.000Z")),
    ).resolves.toEqual({
      totalCredits: 0,
      availableCredits: 0,
      reservedCredits: 0,
    });
    expect(repository.listGrants()).toHaveLength(1);
    expect(repository.listLedgerEntries()).toHaveLength(1);
  });

  it("reserves, consumes, and releases a credit exactly once", async () => {
    const repository = new InMemoryCreditRepository();
    const now = new Date("2026-07-24T14:30:00.000Z");
    await repository.ensureGrant({
      userId: "user-1",
      sourceType: "free_monthly",
      idempotencyKey: "free:user-1:2026-07",
      amount: 2,
      validFrom: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: now,
    });

    await expect(
      repository.reserve({
        id: "attempt-1",
        userId: "user-1",
        operationType: "match_analysis",
        resourceType: "job_application",
        resourceId: "job-1",
        amount: 1,
        expiresAt: new Date("2026-07-25T14:30:00.000Z"),
        createdAt: now,
      }),
    ).resolves.toMatchObject({ reserved: true });
    await expect(repository.getBalance("user-1", now)).resolves.toEqual({
      totalCredits: 2,
      availableCredits: 1,
      reservedCredits: 1,
    });

    await expect(repository.consumeReservation("attempt-1", now)).resolves.toBe(true);
    await expect(repository.consumeReservation("attempt-1", now)).resolves.toBe(true);
    await expect(repository.releaseReservation("attempt-1", "failure", now)).resolves.toBe(false);
    await expect(repository.getBalance("user-1", now)).resolves.toEqual({
      totalCredits: 1,
      availableCredits: 1,
      reservedCredits: 0,
    });
    expect(repository.listLedgerEntries()).toHaveLength(2);
  });

  it("returns a released reservation once and lists abandoned reservations by expiry", async () => {
    const repository = new InMemoryCreditRepository();
    const now = new Date("2026-07-24T14:30:00.000Z");
    await repository.ensureGrant({
      userId: "user-1",
      sourceType: "free_monthly",
      idempotencyKey: "free:user-1:2026-07",
      amount: 1,
      validFrom: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: now,
    });
    await repository.reserve({
      id: "attempt-1",
      userId: "user-1",
      operationType: "match_analysis",
      resourceType: "job_application",
      resourceId: "job-1",
      amount: 1,
      expiresAt: new Date("2026-07-25T14:30:00.000Z"),
      createdAt: now,
    });

    await expect(
      repository.listExpiredReservations({
        at: new Date("2026-07-25T14:30:00.000Z"),
        limit: 10,
      }),
    ).resolves.toHaveLength(1);
    await expect(repository.releaseReservation("attempt-1", "timeout", now)).resolves.toBe(true);
    await expect(repository.releaseReservation("attempt-1", "timeout", now)).resolves.toBe(false);
    expect(repository.listLedgerEntries()).toHaveLength(1);
  });
});
