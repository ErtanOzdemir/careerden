import { describe, expect, it } from "vitest";
import { richDocumentFromText } from "@link2cv/domain";
import { HtmlTemplateRenderer } from "./html-template-renderer.js";

describe("HtmlTemplateRenderer", () => {
  it("renders the default CV from resolved content and omits empty sections", async () => {
    const renderer = new HtmlTemplateRenderer();

    const html = await renderer.render("cv.default", {
      certifications: ["AWS Practitioner"],
      education_content: [richDocumentFromText("Example University")],
      email: "ada@example.com",
      experience_content: [richDocumentFromText("Engineer at Acme")],
      full_name: "Ada Lovelace",
      links: ["https://ada.example.com"],
      location: "London",
      profile_title: "Product Engineer",
      project_content: [],
      skills: ["TypeScript", "React"],
      summary: richDocumentFromText("Tailored product summary."),
    });

    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Tailored product summary.");
    expect(html).toContain("Engineer at Acme");
    expect(html).toContain("Example University");
    expect(html).toContain("AWS Practitioner");
    expect(html).not.toContain("<h2>Projects</h2>");
    expect(html).not.toContain("{{");
  });

  it("renders structured list values as readable HTML instead of JSON", async () => {
    const renderer = new HtmlTemplateRenderer();

    const html = await renderer.render("cv.default", {
      certifications: [],
      education_content: [],
      email: "ada@example.com",
      experience_content: [
        {
          company: "Acme",
          description: richDocumentFromText("Built product experiences."),
          title: "Engineer",
        },
      ],
      full_name: "Ada Lovelace",
      links: [],
      location: "",
      profile_title: "",
      project_content: [],
      skills: [],
      summary: richDocumentFromText("Summary"),
    });

    expect(html).toContain("<dt>Company</dt><dd>Acme</dd>");
    expect(html).toContain("Built product experiences.");
    expect(html).not.toContain("&quot;company&quot;");
    expect(html).not.toContain('{"company"');
  });
});
