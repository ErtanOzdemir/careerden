import type {
  CreditBalance,
  CreditGrantSource,
  CreditOperationType,
  CreditReservation,
  CreditReservationReleaseReason,
  CreditResourceType,
} from "./credit-account.js";

export interface EnsureCreditGrantInput {
  userId: string;
  sourceType: CreditGrantSource;
  idempotencyKey: string;
  amount: number;
  validFrom: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface EnsureCreditGrantResult {
  created: boolean;
  grantId: string;
}

export interface ReserveCreditsInput {
  id: string;
  userId: string;
  operationType: CreditOperationType;
  resourceType: CreditResourceType;
  resourceId: string;
  amount: number;
  expiresAt: Date;
  createdAt: Date;
}

export type ReserveCreditsResult =
  | { reserved: true; reservation: CreditReservation }
  | { reserved: false; availableCredits: number };

export interface ListExpiredCreditReservationsInput {
  at: Date;
  limit: number;
}

export interface CreditRepository {
  ensureGrant(input: EnsureCreditGrantInput): Promise<EnsureCreditGrantResult>;
  getBalance(userId: string, at: Date): Promise<CreditBalance>;
  reserve(input: ReserveCreditsInput): Promise<ReserveCreditsResult>;
  findReservation(id: string): Promise<CreditReservation | null>;
  consumeReservation(id: string, settledAt: Date): Promise<boolean>;
  releaseReservation(
    id: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<boolean>;
  releaseReservationsForResource(
    operationType: CreditOperationType,
    resourceType: CreditResourceType,
    resourceId: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<number>;
  listExpiredReservations(input: ListExpiredCreditReservationsInput): Promise<CreditReservation[]>;
}
