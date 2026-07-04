import { describe, expect, it } from "vitest";
import { documentTemplateVariableAliasesSchema } from "./document-template.schema";

describe("document template schema", () => {
  it("accepts summary as a profile template variable field", () => {
    expect(
      documentTemplateVariableAliasesSchema.parse({
        fields: {
          summary: "profile_description",
        },
      }),
    ).toEqual({
      fields: {
        summary: "profile_description",
      },
    });
  });

  it("accepts only supported selected experience variable fields", () => {
    expect(
      documentTemplateVariableAliasesSchema.parse({
        fields: {},
        selectedExperiences: {
          fields: {},
          items: [
            {
              fields: {
                company: "company_name",
                description: "role_description",
                end_date: "role_end",
                period: "role_period",
                start_date: "role_start",
                title: "role_title",
              },
            },
          ],
        },
      }),
    ).toEqual({
      fields: {},
      selectedExperiences: {
        fields: {},
        items: [
          {
            fields: {
              company: "company_name",
              description: "role_description",
              end_date: "role_end",
              period: "role_period",
              start_date: "role_start",
              title: "role_title",
            },
          },
        ],
      },
    });
  });

  it("rejects selected experience skills and achievements variable fields", () => {
    expect(() =>
      documentTemplateVariableAliasesSchema.parse({
        fields: {},
        selectedExperiences: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "role_achievements",
                skills: "role_skills",
              },
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("accepts only supported selected education variable fields", () => {
    expect(
      documentTemplateVariableAliasesSchema.parse({
        fields: {},
        selectedEducation: {
          fields: {},
          items: [
            {
              fields: {
                degree: "education_degree",
                end_date: "education_end",
                field: "education_field",
                institution: "education_institution",
                period: "education_period",
                start_date: "education_start",
              },
            },
          ],
        },
      }),
    ).toEqual({
      fields: {},
      selectedEducation: {
        fields: {},
        items: [
          {
            fields: {
              degree: "education_degree",
              end_date: "education_end",
              field: "education_field",
              institution: "education_institution",
              period: "education_period",
              start_date: "education_start",
            },
          },
        ],
      },
    });
  });

  it("rejects selected education achievements variable fields", () => {
    expect(() =>
      documentTemplateVariableAliasesSchema.parse({
        fields: {},
        selectedEducation: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "education_achievements",
              },
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("accepts only supported selected project variable fields", () => {
    expect(
      documentTemplateVariableAliasesSchema.parse({
        fields: {},
        selectedProjects: {
          fields: {},
          items: [
            {
              fields: {
                description: "project_description",
                name: "project_name",
                url: "project_url",
              },
            },
          ],
        },
      }),
    ).toEqual({
      fields: {},
      selectedProjects: {
        fields: {},
        items: [
          {
            fields: {
              description: "project_description",
              name: "project_name",
              url: "project_url",
            },
          },
        ],
      },
    });
  });

  it("rejects selected project skills and achievements variable fields", () => {
    expect(() =>
      documentTemplateVariableAliasesSchema.parse({
        fields: {},
        selectedProjects: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "project_achievements",
                skills: "project_skills",
              },
            },
          ],
        },
      }),
    ).toThrow();
  });
});
