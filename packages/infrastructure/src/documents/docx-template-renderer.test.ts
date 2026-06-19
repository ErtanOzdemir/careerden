import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import type { DocumentTemplate } from "@link2cv/domain";
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
});

describe("DocxtemplaterTemplateRenderer", () => {
  it("renders mapped template variables and leaves unknown placeholders untouched", async () => {
    const renderer = new DocxtemplaterTemplateRenderer();
    const template: DocumentTemplate = {
      fieldMappings: {
        leave_me: "email",
      },
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
});

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
