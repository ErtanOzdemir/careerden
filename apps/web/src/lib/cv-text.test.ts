import { describe, expect, it } from "vitest";
import { containsTerm } from "./cv-text.js";

describe("containsTerm", () => {
  it("matches whole terms case-insensitively, including punctuation-heavy names", () => {
    expect(containsTerm("Built APIs with node.js and C++", "Node.js")).toBe(true);
    expect(containsTerm("Built APIs with node.js and C++", "C++")).toBe(true);
    expect(containsTerm("Ran CI/CD pipelines", "CI/CD")).toBe(true);
    expect(containsTerm("Shipped   machine learning models", "machine learning")).toBe(true);
  });

  it("does not match inside longer words", () => {
    expect(containsTerm("Worked at Google", "Go")).toBe(false);
    expect(containsTerm("JavaScript services", "Java")).toBe(false);
    expect(containsTerm("anything", "")).toBe(false);
  });
});
