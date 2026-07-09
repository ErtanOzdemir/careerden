import type { Knex } from "knex";
import { KnexNotificationRepository } from "./knex-notification.repository.js";

export class PostgresNotificationRepository extends KnexNotificationRepository {
  constructor(db: Knex) {
    super(db);
  }
}
