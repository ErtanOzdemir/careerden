import knex from "knex";
import { afterAll, describe, expect, it } from "vitest";
import { applyJobApplicationFilters } from "./knex-job-application.repository.js";

const db = knex({ client: "pg" });

afterAll(async () => {
  await db.destroy();
});

describe("applyJobApplicationFilters", () => {
  it("defaults to active applications and can select archived applications", () => {
    const activeStatement = db("job_applications")
      .modify((query) => applyJobApplicationFilters(query, {}))
      .toSQL();
    const archivedStatement = db("job_applications")
      .modify((query) => applyJobApplicationFilters(query, { archiveState: "archived" }))
      .toSQL();

    expect(activeStatement.sql).toContain('"archived_at" is null');
    expect(archivedStatement.sql).toContain('"archived_at" is not null');
  });

  it("searches JSONB tag values without applying LIKE to the JSONB column", () => {
    const query = db("job_applications");

    applyJobApplicationFilters(query, { search: "typescript" });

    const statement = query.toSQL();
    expect(statement.sql).toContain(
      "jsonb_array_elements_text(tags) AS tag(value) WHERE tag.value ILIKE ?",
    );
    expect(statement.sql).not.toMatch(/tags\s+i?like/i);
    expect(statement.bindings).toContain("%typescript%");
  });

  it("filters an exact tag using JSONB containment", () => {
    const query = db("job_applications");

    applyJobApplicationFilters(query, { tag: "typescript" });

    const statement = query.toSQL();
    expect(statement.sql).toContain("tags @> ?::jsonb");
    expect(statement.bindings).toEqual(['["typescript"]']);
  });
});
