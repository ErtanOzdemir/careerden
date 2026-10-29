import { describe, expect, it } from "vitest";
import { InMemoryCreditRepository } from "@careerden/infrastructure";
import { UnmeteredCreditRepository } from "./unmetered-credit-repository.js";

const createdAt = new Date("2026-10-29T10:00:00.000Z");

function reservation(id: string) {
  return {
    id,
    userId: "user-1",
    operationType: "match_analysis" as const,
    resourceType: "job_application" as const,
    resourceId: `job-${id}`,
    amount: 1,
    expiresAt: new Date(createdAt.getTime() + 60_000),
    createdAt,
  };
}

describe("UnmeteredCreditRepository", () => {
  it("reserves without any prior grant", async () => {
    const credits = new UnmeteredCreditRepository(new InMemoryCreditRepository());

    await expect(credits.reserve(reservation("a"))).resolves.toMatchObject({ reserved: true });
    await expect(credits.findReservation("a")).resolves.toMatchObject({ status: "reserved" });
  });

  it("keeps reserving after existing grants are exhausted", async () => {
    const credits = new UnmeteredCreditRepository(new InMemoryCreditRepository());

    for (const id of ["a", "b", "c"]) {
      await expect(credits.reserve(reservation(id))).resolves.toMatchObject({ reserved: true });
      await expect(credits.consumeReservation(id, createdAt)).resolves.toBe(true);
    }
  });

  it("reuses a grant freed by a released reservation", async () => {
    const inner = new InMemoryCreditRepository();
    const credits = new UnmeteredCreditRepository(inner);

    await credits.reserve(reservation("a"));
    await credits.releaseReservation("a", "failure", createdAt);
    await credits.reserve(reservation("b"));

    expect(inner.listGrants("user-1")).toHaveLength(1);
  });
});
