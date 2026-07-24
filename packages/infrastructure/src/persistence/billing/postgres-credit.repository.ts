import type { Knex } from "knex";
import { KnexCreditRepository } from "./knex-credit.repository.js";

export class PostgresCreditRepository extends KnexCreditRepository {
  constructor(db: Knex) {
    super(db);
  }
}
