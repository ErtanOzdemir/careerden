import { describe, expect, it } from "vitest";
import { listHtmlTemplates, renderHtmlTemplate } from "./html-template-registry.js";
import { richDocumentFromText } from "./rich-document.js";

const cvData = {
  full_name: "Ada Lovelace",
  profile_title: "Programmer",
  email: "ada@example.com",
  location: "London",
  links: ["ada.example.com"],
  summary: richDocumentFromText("Wrote the first published algorithm."),
  experience_content: [richDocumentFromText("Analytical Engine notes")],
  skills: ["Mathematics"],
  education_content: [richDocumentFromText("Private tutoring")],
  project_content: [richDocumentFromText("Bernoulli numbers")],
  certifications: ["Royal Society reader"],
};

describe("CV templates", () => {
  it("offers six CV layouts with distinct ids", () => {
    const ids = listHtmlTemplates("cv").map((template) => template.id);

    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe("cv.default");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(listHtmlTemplates("cv").map((template) => [template.id]))(
    "%s renders every CV section with preview field refs",
    (templateId) => {
      const html = renderHtmlTemplate(templateId, cvData);

      expect(html).not.toContain("{{");
      expect(html).toContain("Ada Lovelace");
      for (const fieldRef of [
        "summary",
        "skills",
        "certifications",
        "experience-0",
        "education-0",
        "project-0",
      ]) {
        expect(html).toContain(`data-field-ref="${fieldRef}"`);
      }
    },
  );
});
