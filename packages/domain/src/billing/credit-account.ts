export type CreditGrantSource = "free_monthly" | "subscription_cycle";
export type CreditOperationType = "match_analysis";
export type CreditResourceType = "job_application";
export type CreditReservationStatus = "reserved" | "consumed" | "released";
export type CreditReservationReleaseReason = "failure" | "timeout" | "deletion" | "superseded";

export interface CreditBalance {
  totalCredits: number;
  availableCredits: number;
  reservedCredits: number;
}

export interface CreditGrant {
  id: string;
  userId: string;
  sourceType: CreditGrantSource;
  idempotencyKey: string;
  amount: number;
  consumedAmount: number;
  reservedAmount: number;
  validFrom: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  grantId: string;
  reservationId?: string;
  entryType: "grant" | "usage";
  delta: number;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreditReservation {
  id: string;
  userId: string;
  grantId: string;
  operationType: CreditOperationType;
  resourceType: CreditResourceType;
  resourceId: string;
  amount: number;
  status: CreditReservationStatus;
  expiresAt: Date;
  releaseReason?: CreditReservationReleaseReason;
  createdAt: Date;
  settledAt?: Date;
}
