import { describe, expect, it } from "vitest";
import { listHtmlTemplates, renderHtmlTemplate } from "./html-template-registry.js";
import { richDocumentFromText } from "./rich-document.js";

const cvData = {
  full_name: "Ada Lovelace",
  profile_title: "Programmer",
  email: "ada@example.com",
  location: "London",
  links: [{ kind: "website", url: "https://ada.example.com/" }],
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

describe("CV contact line", () => {
  it.each(listHtmlTemplates("cv").map((template) => [template.id]))(
    "%s shows the phone between email and location when it is set",
    (templateId) => {
      const html = renderHtmlTemplate(templateId, { ...cvData, phone: "+44 20 7946 0958" });

      expect(html).toMatch(
        /<span>ada@example\.com<\/span>\s*<span>\+44 20 7946 0958<\/span>\s*<span>London<\/span>/,
      );
    },
  );

  it.each(listHtmlTemplates("cv").map((template) => [template.id]))(
    "%s leaves no empty span behind without a phone",
    (templateId) => {
      const html = renderHtmlTemplate(templateId, { ...cvData, phone: "" });

      expect(html).toMatch(/<span>ada@example\.com<\/span>\s*<span>London<\/span>\s*<\/p>/);
      expect(html).not.toContain("<span></span>");
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

describe("CV header links", () => {
  const links = [
    { kind: "linkedin", url: "https://www.linkedin.com/in/ada/" },
    { kind: "github", url: "https://github.com/ada" },
    { kind: "website", url: "https://ada.example.com/" },
    { kind: "portfolio", url: "https://ada.example.com/work?a=1&b=2" },
    { kind: "other", url: "https://ada.example.org/notes" },
  ];

  it.each(listHtmlTemplates("cv").map((template) => [template.id]))(
    "%s links each profile link with its icon and short URL",
    (templateId) => {
      const html = renderHtmlTemplate(templateId, { ...cvData, links });
      const items = [...html.matchAll(/<li><a class="profile-link"[\s\S]*?<\/a><\/li>/g)].map(
        (match) => match[0],
      );

      expect(items).toHaveLength(5);
      expect(items[0]).toContain('href="https://www.linkedin.com/in/ada/"');
      expect(items[0]).toContain("<span>linkedin.com/in/ada</span>");
      expect(items[1]).toContain('href="https://github.com/ada"');
      expect(items[1]).toContain("<span>github.com/ada</span>");
      expect(items[3]).toContain('href="https://ada.example.com/work?a=1&amp;b=2"');
      expect(items[3]).toContain("<span>ada.example.com/work?a=1&amp;b=2</span>");
      for (const item of items) {
        expect(item).toMatch(/<svg class="link-icon"[^>]*aria-hidden="true"/);
        expect(item).toContain('width="1em" height="1em"');
        expect(item).toContain("currentColor");
      }
      // Every kind has its own icon.
      expect(new Set(items.map((item) => item.match(/<svg[\s\S]*<\/svg>/)?.[0])).size).toBe(5);
      expect(html).toContain(".inline-list .link-icon {");
    },
  );

  it.each(listHtmlTemplates("cv").map((template) => [template.id]))(
    "%s leaves out the links list when there are no links",
    (templateId) => {
      for (const value of [[], undefined, [{ kind: "website", url: "javascript:alert(1)" }]]) {
        const html = renderHtmlTemplate(templateId, { ...cvData, links: value });

        expect(html).not.toContain('<ul class="inline-list">');
        expect(html).not.toContain("profile-link");
      }
    },
  );

  it("never turns a non-http URL into an href and escapes the rest", () => {
    const html = renderHtmlTemplate("cv.default", {
      ...cvData,
      links: [
        { kind: "website", url: 'javascript:alert("x")' },
        { kind: "website", url: "data:text/html,hi" },
        { kind: "github", url: 'https://github.com/ada"><script>' },
      ],
    });

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text");
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="https://github.com/ada&quot;&gt;&lt;script&gt;"');
  });

  it("still renders legacy plain URL strings", () => {
    const html = renderHtmlTemplate("cv.default", {
      ...cvData,
      links: ["https://github.com/ada"],
    });

    expect(html).toContain('href="https://github.com/ada"');
    expect(html).toContain("<span>github.com/ada</span>");
  });
});
