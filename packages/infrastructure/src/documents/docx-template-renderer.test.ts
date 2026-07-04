import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import type { DocumentTemplate } from "@link2cv/domain";
import type { RichDocument } from "@link2cv/domain";
import { DocxtemplaterTemplateRenderer, buildDocxAliasData } from "./docx-template-renderer.js";

describe("buildDocxAliasData", () => {
  it("uses only the exact template names configured for each profile input", () => {
    const template = {
      fieldMappings: {},
      placeholders: [],
      variableAliases: {
        fields: { full_name: "candidate_name" },
        linkItems: [{ variableName: "linkedin_url" }, { variableName: "portfolio_url" }],
        selectedEducation: {
          fields: {},
          items: [{ fields: { institution: "school_name", period: "school_dates" } }],
        },
        selectedExperiences: {
          fields: {},
          items: [
            { fields: { company: "first_company", title: "first_role" } },
            { fields: { company: "second_company", title: "second_role" } },
          ],
        },
      },
    } as unknown as DocumentTemplate;

    const aliases = buildDocxAliasData(template, {
      full_name: "Ada Lovelace",
      links: ["https://linkedin.com/in/ada", "https://ada.example.com"],
      selected_education: [
        {
          achievements: ["Honours"],
          degree: "BSc",
          end_date: "2004",
          field: "Mathematics",
          institution: "University",
          period: "2000 - 2004",
          start_date: "2000",
        },
      ],
      selected_experiences: [
        {
          achievements: ["Built profile tooling"],
          company: "Link2CV",
          description: "Shipped document generation",
          end_date: "2024",
          period: "2020 - 2024",
          skills: ["TypeScript"],
          start_date: "2020",
          title: "Engineer",
        },
        {
          achievements: ["Led the team"],
          company: "Acme",
          description: "Scaled the product",
          end_date: "Present",
          period: "2024 - Present",
          skills: ["Leadership"],
          start_date: "2024",
          title: "Lead",
        },
      ],
    });

    expect(aliases).toEqual({
      candidate_name: "Ada Lovelace",
      first_company: "Link2CV",
      first_role: "Engineer",
      linkedin_url: "https://linkedin.com/in/ada",
      portfolio_url: "https://ada.example.com",
      second_company: "Acme",
      second_role: "Lead",
      school_dates: "2000 - 2004",
      school_name: "University",
    });
  });

  it("falls back to direct field mappings when no alias is configured", () => {
    const template = {
      fieldMappings: {
        summary: "summary",
      },
      placeholders: ["summary"],
      variableAliases: {
        fields: {},
      },
    } as unknown as DocumentTemplate;

    const aliases = buildDocxAliasData(template, {
      raw_summary: "Old user summary",
      summary: {
        version: 1,
        blocks: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "AI summary" }],
          },
        ],
      },
    });

    expect(aliases.summary).toEqual({
      version: 1,
      blocks: [
        {
          type: "paragraph",
          children: [{ type: "text", text: "AI summary" }],
        },
      ],
    });
  });

  it("ignores stale selected experience, education, and project aliases for removed fields", () => {
    const template = {
      fieldMappings: {},
      placeholders: [],
      variableAliases: {
        fields: {},
        selectedEducation: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "education_achievements",
                institution: "education_institution",
              },
            },
          ],
        },
        selectedExperiences: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "experience_achievements",
                company: "experience_company",
                skills: "experience_skills",
              },
            },
          ],
        },
        selectedProjects: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "project_achievements",
                name: "project_name",
                skills: "project_skills",
              },
            },
          ],
        },
      },
    } as unknown as DocumentTemplate;

    const aliases = buildDocxAliasData(template, {
      selected_education: [
        {
          achievements: ["Honours"],
          institution: "University",
        },
      ],
      selected_experiences: [
        {
          achievements: ["Built profile tooling"],
          company: "Link2CV",
          skills: ["TypeScript"],
        },
      ],
      selected_projects: [
        {
          achievements: ["Launched redesign"],
          name: "Portfolio",
          skills: ["React"],
        },
      ],
    });

    expect(aliases).toEqual({
      education_institution: "University",
      experience_company: "Link2CV",
      project_name: "Portfolio",
    });
  });
});

describe("DocxtemplaterTemplateRenderer", () => {
  it("renders a standalone rich placeholder as native Word content", async () => {
    const renderer = new DocxtemplaterTemplateRenderer();
    const template = createTemplate({
      placeholders: ["summary"],
      variableAliases: { fields: { customized_summary: "summary" } },
    });
    const richSummary: RichDocument = {
      version: 1,
      blocks: [
        {
          type: "heading",
          level: 2,
          alignment: "center",
          children: [{ type: "text", text: "Profile", marks: [{ type: "bold" }] }],
        },
        {
          type: "bulletList",
          items: [
            {
              blocks: [
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "TypeScript", marks: [{ type: "italic" }] }],
                },
              ],
            },
          ],
        },
      ],
    };

    const rendered = await renderer.render({
      data: { customized_summary: richSummary },
      template,
      templateBody: createMinimalDocx("{{summary}}"),
    });

    const zip = new PizZip(rendered);
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";

    expect(documentXml).toContain('<w:pStyle w:val="Heading2"/>');
    expect(documentXml).toContain('<w:jc w:val="center"/>');
    expect(documentXml).toContain("<w:b/>");
    expect(documentXml).toContain("<w:i/>");
    expect(documentXml).toContain("<w:numPr>");
    expect(zip.file("word/numbering.xml")?.asText()).toContain("w:abstractNum");
  });

  it("rejects a rich placeholder embedded in surrounding text", async () => {
    const renderer = new DocxtemplaterTemplateRenderer();
    const template = createTemplate({
      placeholders: ["summary"],
      variableAliases: { fields: { customized_summary: "summary" } },
    });

    await expect(
      renderer.render({
        data: {
          customized_summary: {
            version: 1,
            blocks: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Summary" }],
              },
            ],
          },
        },
        template,
        templateBody: createMinimalDocx("Before {{summary}} after"),
      }),
    ).rejects.toThrow('Rich DOCX placeholder "summary" must occupy its own paragraph');
  });

  it("renders mapped template variables and leaves unknown placeholders untouched", async () => {
    const renderer = new DocxtemplaterTemplateRenderer();
    const template: DocumentTemplate = {
      fieldMappings: {},
      fileId: "templates/cv.docx",
      fileName: "cv.docx",
      format: "docx",
      id: "template-1",
      isDefault: true,
      kind: "cv",
      placeholders: ["candidate_name", "leave_me"],
      profileId: "profile-1",
      size: 1,
      variableAliases: {
        fields: {
          full_name: "candidate_name",
        },
      },
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const templateBody = createMinimalDocx("Hello {{candidate_name}} / {{leave_me}}");

    const rendered = await renderer.render({
      data: {
        email: "ada@example.com",
        full_name: "Ada Lovelace",
      },
      template,
      templateBody,
    });

    const zip = new PizZip(rendered);
    const documentXml = zip.file("word/document.xml")?.asText();

    expect(documentXml).toContain("Ada Lovelace");
    expect(documentXml).toContain("{{leave_me}}");
  });

  it("renders an AI summary through a direct summary field mapping", async () => {
    const renderer = new DocxtemplaterTemplateRenderer();
    const template = createTemplate({
      fieldMappings: { summary: "summary" },
      placeholders: ["summary"],
    });
    const rendered = await renderer.render({
      data: {
        summary: {
          version: 1,
          blocks: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "Tailored AI summary" }],
            },
          ],
        },
        raw_summary: "Old user summary",
      },
      template,
      templateBody: createMinimalDocx("{{summary}}"),
    });

    const zip = new PizZip(rendered);
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";

    expect(documentXml).toContain("Tailored AI summary");
    expect(documentXml).not.toContain("Old user summary");
  });
});

function createTemplate(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    fieldMappings: {},
    fileId: "templates/cv.docx",
    fileName: "cv.docx",
    format: "docx",
    id: "template-1",
    isDefault: true,
    kind: "cv",
    placeholders: [],
    profileId: "profile-1",
    size: 1,
    variableAliases: { fields: {} },
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMinimalDocx(text: string): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip
    .folder("word")
    ?.folder("_rels")
    ?.file(
      "document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
    );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${text}</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`,
  );

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
