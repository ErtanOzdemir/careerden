import { describe, expect, it } from "vitest";
import {
  groupSkillsBySkillGroups,
  hasNamedSkillGroups,
  normalizeSkillGroups,
  profileSkills,
  replaceProfileSkills,
} from "./skill-groups.js";

describe("normalizeSkillGroups", () => {
  it("trims, merges same-named groups, drops blanks and repeats, and puts uncategorized last", () => {
    expect(
      normalizeSkillGroups([
        { name: "", skills: ["Excel"] },
        { name: " DevOps ", skills: ["AWS", " Docker ", ""] },
        { name: "Frontend", skills: ["React", "aws"] },
        { name: "devops", skills: ["Kubernetes", "docker"] },
        { name: "Empty", skills: [" "] },
        { name: " ", skills: ["Notion"] },
      ]),
    ).toEqual([
      { name: "DevOps", skills: ["AWS", "Docker", "Kubernetes"] },
      { name: "Frontend", skills: ["React"] },
      { name: "", skills: ["Excel", "Notion"] },
    ]);
  });
});

describe("profileSkills", () => {
  it("lists every skill in group order", () => {
    expect(
      profileSkills([
        { name: "DevOps", skills: ["AWS", "Docker"] },
        { name: "", skills: ["Excel"] },
      ]),
    ).toEqual(["AWS", "Docker", "Excel"]);
  });
});

describe("groupSkillsBySkillGroups", () => {
  const groups = [
    { name: "DevOps", skills: ["AWS", "Docker"] },
    { name: "Frontend", skills: ["React", "CSS"] },
    { name: "", skills: ["Excel"] },
  ];

  it("orders categories by their first skill and keeps the document's skill order", () => {
    expect(groupSkillsBySkillGroups(["React", "docker", "Excel", "AWS"], groups)).toEqual([
      { name: "Frontend", skills: ["React"] },
      { name: "DevOps", skills: ["docker", "AWS"] },
      { name: "", skills: ["Excel"] },
    ]);
  });

  it("puts skills outside every category in the uncategorized group", () => {
    expect(groupSkillsBySkillGroups(["GraphQL", "CSS"], groups)).toEqual([
      { name: "Frontend", skills: ["CSS"] },
      { name: "", skills: ["GraphQL"] },
    ]);
  });

  it("keeps a single uncategorized group for profiles without categories", () => {
    const grouped = groupSkillsBySkillGroups(
      ["TypeScript", "SQL"],
      [{ name: "", skills: ["TypeScript", "SQL"] }],
    );

    expect(grouped).toEqual([{ name: "", skills: ["TypeScript", "SQL"] }]);
    expect(hasNamedSkillGroups(grouped)).toBe(false);
  });
});

describe("replaceProfileSkills", () => {
  it("keeps remaining skills in their category and adds new ones uncategorized", () => {
    expect(
      replaceProfileSkills(
        [
          { name: "DevOps", skills: ["AWS", "Docker"] },
          { name: "", skills: ["Excel"] },
        ],
        ["docker", "Excel", "Figma"],
      ),
    ).toEqual([
      { name: "DevOps", skills: ["Docker"] },
      { name: "", skills: ["Excel", "Figma"] },
    ]);
  });
});
