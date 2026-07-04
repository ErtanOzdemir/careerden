import { describe, expect, it } from "vitest";
import { InMemoryUserProfileRepository } from "./in-memory-user-profile.repository.js";

describe("InMemoryUserProfileRepository", () => {
  it("updates profile sections without replacing untouched fields", async () => {
    const repository = new InMemoryUserProfileRepository();
    const profile = await repository.create({
      email: "ada@example.com",
      experience: [
        {
          company: "Link2CV",
          description: "Built a profile manager",
          title: "Engineer",
        },
      ],
      fullName: "Ada Lovelace",
      headline: "Engineer",
      skills: ["TypeScript"],
    });

    const updated = await repository.update(profile.id, {
      education: [
        {
          degree: "BSc",
          institution: "University",
        },
      ],
      skills: ["TypeScript", "React"],
    });

    expect(updated?.fullName).toBe("Ada Lovelace");
    expect(updated?.experience).toEqual(profile.experience);
    expect(updated?.education).toEqual([{ degree: "BSc", institution: "University" }]);
    expect(updated?.skills).toEqual(["TypeScript", "React"]);
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(profile.updatedAt.getTime());
  });

  it("returns null when updating a missing profile", async () => {
    const repository = new InMemoryUserProfileRepository();

    await expect(repository.update("missing", { skills: ["React"] })).resolves.toBeNull();
  });

  it("defaults and updates auto-run match analysis", async () => {
    const repository = new InMemoryUserProfileRepository();
    const profile = await repository.create({
      email: "ada@example.com",
      experience: [],
      fullName: "Ada Lovelace",
      skills: [],
    });

    expect(profile.autoRunMatchAnalysis).toBe(true);

    const updated = await repository.update(profile.id, { autoRunMatchAnalysis: false });

    expect(updated?.autoRunMatchAnalysis).toBe(false);
  });

  it("manages profile document templates and default selection", async () => {
    const repository = new InMemoryUserProfileRepository();
    const profile = await repository.create({
      email: "ada@example.com",
      experience: [],
      fullName: "Ada Lovelace",
      skills: [],
    });

    const first = await repository.createDocumentTemplate({
      profileId: profile.id,
      kind: "cv",
      format: "docx",
      fileId: "templates/first.docx",
      fileName: "first.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 100,
      placeholders: ["summary"],
    });
    const second = await repository.createDocumentTemplate({
      profileId: profile.id,
      kind: "cv",
      format: "docx",
      fileId: "templates/second.docx",
      fileName: "second.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 120,
      placeholders: ["intro"],
    });
    const mapped = await repository.updateDocumentTemplateMappings(second.id, {
      intro: "customized_summary",
    });
    const aliased = await repository.updateDocumentTemplateVariableAliases(second.id, {
      fields: { full_name: "candidate_name" },
      selectedExperiences: {
        fields: {},
        items: [{ fields: { title: "role_name", company: "employer", period: "dates" } }],
      },
    });
    const selected = await repository.setDefaultDocumentTemplate(profile.id, second.id);

    expect(first.isDefault).toBe(true);
    expect(mapped?.fieldMappings).toEqual({ intro: "customized_summary" });
    expect(aliased?.variableAliases).toEqual({
      fields: { full_name: "candidate_name" },
      selectedExperiences: {
        fields: {},
        items: [{ fields: { title: "role_name", company: "employer", period: "dates" } }],
      },
    });
    expect(
      (await repository.listDocumentTemplates(profile.id)).find((item) => item.id === second.id)
        ?.variableAliases,
    ).toEqual(aliased?.variableAliases);
    expect(selected?.isDefault).toBe(true);
    await expect(repository.findDefaultDocumentTemplate(profile.id, "cv")).resolves.toMatchObject({
      id: second.id,
    });
    expect(
      (await repository.listDocumentTemplates(profile.id)).filter((item) => item.isDefault),
    ).toHaveLength(1);
  });
});
