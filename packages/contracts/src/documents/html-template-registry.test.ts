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

describe("CV skills section", () => {
  it.each(listHtmlTemplates("cv").map((template) => [template.id]))(
    "%s keeps one plain skills list when nothing is categorized",
    (templateId) => {
      const html = renderHtmlTemplate(templateId, {
        ...cvData,
        skills: ["Mathematics", "Notation"],
        skill_groups: [{ name: "", skills: ["Mathematics", "Notation"] }],
      });

      expect(html).toContain(
        '<div class="skill-groups" data-field-ref="skills"><ul class="skills-list"><li>Mathematics</li><li>Notation</li></ul></div>',
      );
      expect(html).not.toContain('class="skill-group-name"');
    },
  );

  it.each(listHtmlTemplates("cv").map((template) => [template.id]))(
    "%s shows each category under its name, with uncategorized skills as Other",
    (templateId) => {
      const html = renderHtmlTemplate(templateId, {
        ...cvData,
        skills: ["Kubernetes", "React", "Notation"],
        skill_groups: [
          { name: "DevOps", skills: ["Kubernetes"] },
          { name: "Front <end>", skills: ["React"] },
          { name: "", skills: ["Notation"] },
        ],
      });

      expect(html).toContain(
        '<div class="skill-group"><h3 class="skill-group-name">DevOps</h3><ul class="skills-list"><li>Kubernetes</li></ul></div>' +
          '<div class="skill-group"><h3 class="skill-group-name">Front &lt;end&gt;</h3><ul class="skills-list"><li>React</li></ul></div>' +
          '<div class="skill-group"><h3 class="skill-group-name">Other</h3><ul class="skills-list"><li>Notation</li></ul></div>',
      );
    },
  );

  it("falls back to the flat skills list when no groups are passed", () => {
    const html = renderHtmlTemplate("cv.default", { ...cvData, skills: ["Mathematics"] });

    expect(html).toContain('<ul class="skills-list"><li>Mathematics</li></ul>');
  });

  it("omits the skills section when there are no skills", () => {
    const html = renderHtmlTemplate("cv.default", { ...cvData, skills: [], skill_groups: [] });

    expect(html).not.toContain('data-field-ref="skills"');
  });
});
