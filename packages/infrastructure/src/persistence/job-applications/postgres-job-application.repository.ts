import type { Knex } from "knex";
import { KnexJobApplicationRepository } from "./knex-job-application.repository.js";

export class PostgresJobApplicationRepository extends KnexJobApplicationRepository {
  constructor(db: Knex) {
    super(db);
  }
}
