import type {
  CreditBalance,
  CreditOperationType,
  CreditRepository,
  CreditReservation,
  CreditReservationReleaseReason,
  CreditResourceType,
  EnsureCreditGrantInput,
  EnsureCreditGrantResult,
  ListExpiredCreditReservationsInput,
  ReserveCreditsInput,
  ReserveCreditsResult,
} from "@careerden/domain";

// Keeps the reservation lifecycle intact while never refusing a reservation for lack of balance.
// A just-in-time grant matching the requested amount backs each reservation that would fail.
export class UnmeteredCreditRepository implements CreditRepository {
  constructor(private readonly inner: CreditRepository) {}

  ensureGrant(input: EnsureCreditGrantInput): Promise<EnsureCreditGrantResult> {
    return this.inner.ensureGrant(input);
  }

  getBalance(userId: string, at: Date): Promise<CreditBalance> {
    return this.inner.getBalance(userId, at);
  }

  async reserve(input: ReserveCreditsInput): Promise<ReserveCreditsResult> {
    const result = await this.inner.reserve(input);
    if (result.reserved) return result;

    await this.inner.ensureGrant({
      userId: input.userId,
      sourceType: "free_monthly",
      idempotencyKey: `unmetered:${input.id}`,
      amount: input.amount,
      validFrom: input.createdAt,
      metadata: { unmetered: true },
      createdAt: input.createdAt,
    });
    return this.inner.reserve(input);
  }

  findReservation(id: string): Promise<CreditReservation | null> {
    return this.inner.findReservation(id);
  }

  consumeReservation(id: string, settledAt: Date): Promise<boolean> {
    return this.inner.consumeReservation(id, settledAt);
  }

  releaseReservation(
    id: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<boolean> {
    return this.inner.releaseReservation(id, reason, settledAt);
  }

  releaseReservationsForResource(
    operationType: CreditOperationType,
    resourceType: CreditResourceType,
    resourceId: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<number> {
    return this.inner.releaseReservationsForResource(
      operationType,
      resourceType,
      resourceId,
      reason,
      settledAt,
    );
  }

  listExpiredReservations(input: ListExpiredCreditReservationsInput): Promise<CreditReservation[]> {
    return this.inner.listExpiredReservations(input);
  }
}
