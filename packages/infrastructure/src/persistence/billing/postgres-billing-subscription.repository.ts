import type { Knex } from "knex";
import { KnexBillingSubscriptionRepository } from "./knex-billing-subscription.repository.js";

export class PostgresBillingSubscriptionRepository extends KnexBillingSubscriptionRepository {
  constructor(db: Knex) {
    super(db);
  }
}
