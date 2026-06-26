import type { Knex } from "knex";
import { SqliteJobApplicationRepository } from "./sqlite-job-application.repository.js";

export class PostgresJobApplicationRepository extends SqliteJobApplicationRepository {
  constructor(db: Knex) {
    super(db);
  }
}
