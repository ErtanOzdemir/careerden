import knex from "knex";
import { afterAll, describe, expect, it } from "vitest";
import {
  applyJobApplicationFilters,
  buildClearApplicationPackTemplateSelectionQuery,
} from "./knex-job-application.repository.js";

const db = knex({ client: "pg" });

afterAll(async () => {
  await db.destroy();
});

describe("applyJobApplicationFilters", () => {
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

describe("buildClearApplicationPackTemplateSelectionQuery", () => {
  it("removes only the selected template key for matching profile applications", () => {
    const statement = buildClearApplicationPackTemplateSelectionQuery(
      db,
      "profile-1",
      "cover_letter",
      "template-1",
    ).toSQL();

    expect(statement.sql).toContain("application_pack_preferences - ?");
    expect(statement.sql).toContain("application_pack_preferences ->> ? = ?");
    expect(statement.sql).toContain('where "profile_id" = ?');
    expect(statement.bindings).toEqual([
      "coverLetterTemplateId",
      "profile-1",
      "coverLetterTemplateId",
      "template-1",
    ]);
  });
});
