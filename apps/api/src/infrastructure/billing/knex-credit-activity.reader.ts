import type { Knex } from "knex";
import type {
  CreditActivity,
  CreditActivityKind,
  CreditActivityReader,
} from "../../domain/billing/credit-activity.js";

interface CreditActivityRow {
  id: string;
  entry_type: "grant" | "usage";
  delta: number;
  created_at: Date;
  source_type: "free_monthly" | "subscription_cycle";
  resource_id: string | null;
  application_exists: boolean;
  role_title: string | null;
  company_name: string | null;
}

export class KnexCreditActivityReader implements CreditActivityReader {
  constructor(private readonly db: Knex) {}

  async listRecent(userId: string, limit: number): Promise<CreditActivity[]> {
    const rows = await this.db("credit_ledger_entries as ledger")
      .join("credit_grants as grant", "grant.id", "ledger.grant_id")
      .leftJoin("credit_reservations as reservation", "reservation.id", "ledger.reservation_id")
      .leftJoin("job_applications as application", "application.id", "reservation.resource_id")
      .leftJoin("user_profiles as profile", function joinOwnedProfile() {
        this.on("profile.id", "=", "application.profile_id").andOn(
          "profile.user_id",
          "=",
          "ledger.user_id",
        );
      })
      .where("ledger.user_id", userId)
      .orderBy([
        { column: "ledger.created_at", order: "desc" },
        { column: "ledger.id", order: "desc" },
      ])
      .limit(limit)
      .select<CreditActivityRow[]>(
        "ledger.id",
        "ledger.entry_type",
        "ledger.delta",
        "ledger.created_at",
        "grant.source_type",
        "reservation.resource_id",
        this.db.raw("profile.id is not null as application_exists"),
        this.db.raw(
          "case when profile.id is null then null else application.role_title end as role_title",
        ),
        this.db.raw(
          "case when profile.id is null then null else application.company_name end as company_name",
        ),
      );

    return rows.map(toCreditActivity);
  }
}

function toCreditActivity(row: CreditActivityRow): CreditActivity {
  const kind = activityKind(row);
  return {
    id: row.id,
    kind,
    delta: Number(row.delta),
    occurredAt: new Date(row.created_at),
    ...(kind === "analysis_usage" && row.resource_id
      ? {
          jobApplication: {
            id: row.resource_id,
            deleted: !row.application_exists,
            roleTitle: row.role_title ?? undefined,
            companyName: row.company_name ?? undefined,
          },
        }
      : {}),
  };
}

function activityKind(row: CreditActivityRow): CreditActivityKind {
  if (row.entry_type === "usage") return "analysis_usage";
  return row.source_type === "subscription_cycle" ? "subscription_grant" : "free_monthly_grant";
}
