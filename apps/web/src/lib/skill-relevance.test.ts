import { describe, expect, it } from "vitest";
import { orderSkillsByRelevance } from "./skill-relevance.js";

describe("orderSkillsByRelevance", () => {
  it("moves job keywords and requirement mentions first and keeps ties in the user's order", () => {
    expect(
      orderSkillsByRelevance(
        ["Photoshop", "Docker", "Go", "React", "Figma"],
        ["React", "Kubernetes"],
        ["Build containers with Docker", "Ship React frontends"],
      ),
    ).toEqual(["React", "Docker", "Photoshop", "Go", "Figma"]);
  });

  it("returns an unrelated list unchanged", () => {
    expect(orderSkillsByRelevance(["Baking", "Knitting"], ["React"], ["Ship React apps"])).toEqual([
      "Baking",
      "Knitting",
    ]);
  });
});
