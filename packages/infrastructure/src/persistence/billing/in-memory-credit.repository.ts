import { randomUUID } from "node:crypto";
import type {
  CreditBalance,
  CreditGrant,
  CreditLedgerEntry,
  CreditReservation,
  CreditReservationReleaseReason,
  CreditRepository,
  EnsureCreditGrantInput,
  EnsureCreditGrantResult,
  ListExpiredCreditReservationsInput,
  ReserveCreditsInput,
  ReserveCreditsResult,
} from "@careerden/domain";

export class InMemoryCreditRepository implements CreditRepository {
  private readonly accounts = new Set<string>();
  private readonly grants = new Map<string, CreditGrant>();
  private readonly grantIdsByIdempotencyKey = new Map<string, string>();
  private readonly ledgerEntries = new Map<string, CreditLedgerEntry>();
  private readonly reservations = new Map<string, CreditReservation>();

  async ensureGrant(input: EnsureCreditGrantInput): Promise<EnsureCreditGrantResult> {
    this.accounts.add(input.userId);

    const existingGrantId = this.grantIdsByIdempotencyKey.get(input.idempotencyKey);
    if (existingGrantId) {
      return { created: false, grantId: existingGrantId };
    }

    const grantId = randomUUID();
    const grant: CreditGrant = {
      id: grantId,
      userId: input.userId,
      sourceType: input.sourceType,
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      consumedAmount: 0,
      reservedAmount: 0,
      validFrom: new Date(input.validFrom),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.createdAt),
    };
    const ledgerIdempotencyKey = `grant:${input.idempotencyKey}`;

    this.grants.set(grantId, grant);
    this.grantIdsByIdempotencyKey.set(input.idempotencyKey, grantId);
    this.ledgerEntries.set(ledgerIdempotencyKey, {
      id: randomUUID(),
      userId: input.userId,
      grantId,
      entryType: "grant",
      delta: input.amount,
      idempotencyKey: ledgerIdempotencyKey,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: new Date(input.createdAt),
    });

    return { created: true, grantId };
  }

  async getBalance(userId: string, at: Date): Promise<CreditBalance> {
    const activeGrants = [...this.grants.values()].filter(
      (grant) =>
        grant.userId === userId &&
        grant.validFrom <= at &&
        (!grant.expiresAt || grant.expiresAt > at),
    );
    const availableCredits = activeGrants.reduce(
      (total, grant) => total + grant.amount - grant.consumedAmount - grant.reservedAmount,
      0,
    );
    const reservedCredits = activeGrants.reduce((total, grant) => total + grant.reservedAmount, 0);

    return {
      totalCredits: availableCredits + reservedCredits,
      availableCredits,
      reservedCredits,
    };
  }

  async reserve(input: ReserveCreditsInput): Promise<ReserveCreditsResult> {
    const grant = [...this.grants.values()]
      .filter(
        (candidate) =>
          candidate.userId === input.userId &&
          candidate.validFrom <= input.createdAt &&
          (!candidate.expiresAt || candidate.expiresAt > input.createdAt) &&
          candidate.amount - candidate.consumedAmount - candidate.reservedAmount >= input.amount,
      )
      .sort(
        (left, right) =>
          (left.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) -
            (right.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) ||
          left.createdAt.getTime() - right.createdAt.getTime(),
      )[0];
    if (!grant) {
      const balance = await this.getBalance(input.userId, input.createdAt);
      return { reserved: false, availableCredits: balance.availableCredits };
    }
    const reservation: CreditReservation = {
      id: input.id,
      userId: input.userId,
      grantId: grant.id,
      operationType: input.operationType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      amount: input.amount,
      status: "reserved",
      expiresAt: new Date(input.expiresAt),
      createdAt: new Date(input.createdAt),
    };
    grant.reservedAmount += input.amount;
    grant.updatedAt = new Date(input.createdAt);
    this.reservations.set(input.id, reservation);
    return { reserved: true, reservation: structuredClone(reservation) };
  }

  async findReservation(id: string): Promise<CreditReservation | null> {
    const reservation = this.reservations.get(id);
    return reservation ? structuredClone(reservation) : null;
  }

  async consumeReservation(id: string, settledAt: Date): Promise<boolean> {
    const reservation = this.reservations.get(id);
    if (!reservation || reservation.status !== "reserved") {
      return reservation?.status === "consumed";
    }
    const grant = this.grants.get(reservation.grantId);
    if (!grant) throw new Error(`Credit grant ${reservation.grantId} was not found`);
    grant.reservedAmount -= reservation.amount;
    grant.consumedAmount += reservation.amount;
    grant.updatedAt = new Date(settledAt);
    reservation.status = "consumed";
    reservation.settledAt = new Date(settledAt);
    const idempotencyKey = `usage:${id}`;
    this.ledgerEntries.set(idempotencyKey, {
      id: randomUUID(),
      userId: reservation.userId,
      grantId: reservation.grantId,
      reservationId: id,
      entryType: "usage",
      delta: -reservation.amount,
      idempotencyKey,
      metadata: {
        operationType: reservation.operationType,
        resourceType: reservation.resourceType,
        resourceId: reservation.resourceId,
      },
      createdAt: new Date(settledAt),
    });
    return true;
  }

  async releaseReservation(
    id: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<boolean> {
    const reservation = this.reservations.get(id);
    if (!reservation || reservation.status !== "reserved") return false;
    const grant = this.grants.get(reservation.grantId);
    if (!grant) throw new Error(`Credit grant ${reservation.grantId} was not found`);
    grant.reservedAmount -= reservation.amount;
    grant.updatedAt = new Date(settledAt);
    reservation.status = "released";
    reservation.releaseReason = reason;
    reservation.settledAt = new Date(settledAt);
    return true;
  }

  async releaseReservationsForResource(
    operationType: "match_analysis",
    resourceType: "job_application",
    resourceId: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<number> {
    let released = 0;
    for (const reservation of this.reservations.values()) {
      if (
        reservation.operationType === operationType &&
        reservation.resourceType === resourceType &&
        reservation.resourceId === resourceId &&
        (await this.releaseReservation(reservation.id, reason, settledAt))
      ) {
        released += 1;
      }
    }
    return released;
  }

  async listExpiredReservations(
    input: ListExpiredCreditReservationsInput,
  ): Promise<CreditReservation[]> {
    return [...this.reservations.values()]
      .filter(
        (reservation) => reservation.status === "reserved" && reservation.expiresAt <= input.at,
      )
      .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime())
      .slice(0, input.limit)
      .map((reservation) => structuredClone(reservation));
  }

  listGrants(userId?: string): CreditGrant[] {
    return [...this.grants.values()]
      .filter((grant) => !userId || grant.userId === userId)
      .map((grant) => structuredClone(grant));
  }

  listLedgerEntries(userId?: string): CreditLedgerEntry[] {
    return [...this.ledgerEntries.values()]
      .filter((entry) => !userId || entry.userId === userId)
      .map((entry) => structuredClone(entry));
  }

  listReservations(userId?: string): CreditReservation[] {
    return [...this.reservations.values()]
      .filter((reservation) => !userId || reservation.userId === userId)
      .map((reservation) => structuredClone(reservation));
  }
}
