import { describe, expect, it } from "vitest";
import {
  formatProfileLinkLabel,
  inferProfileLinkKind,
  isHttpProfileLinkUrl,
  normalizeProfileLinks,
  normalizeProfileLinkUrl,
  profileLinkKey,
} from "./profile-links.js";

describe("inferProfileLinkKind", () => {
  it.each([
    ["https://www.linkedin.com/in/ada", "linkedin"],
    ["https://uk.linkedin.com/in/ada", "linkedin"],
    ["https://LinkedIn.com/in/ada", "linkedin"],
    ["https://github.com/ada", "github"],
    ["https://gist.github.com/ada", "github"],
    ["https://ada.github.io", "website"],
    ["https://notlinkedin.com/ada", "website"],
    ["https://ada.dev", "website"],
    ["not a url", "website"],
  ])("suggests a kind for %s", (url, kind) => {
    expect(inferProfileLinkKind(url)).toBe(kind);
  });
});

describe("normalizeProfileLinkUrl", () => {
  it("adds https to schemeless links and keeps http and https ones", () => {
    expect(normalizeProfileLinkUrl(" github.com/ada ")).toBe("https://github.com/ada");
    expect(normalizeProfileLinkUrl("http://ada.dev/work")).toBe("http://ada.dev/work");
    expect(normalizeProfileLinkUrl("HTTPS://ada.dev")).toBe("https://ada.dev/");
    expect(normalizeProfileLinkUrl("ada.dev:8080/cv")).toBe("https://ada.dev:8080/cv");
    expect(normalizeProfileLinkUrl("medium.com/@ada")).toBe("https://medium.com/@ada");
  });

  it.each([
    "",
    "   ",
    "not a link",
    "localhost",
    "ada@example.com",
    "javascript:alert(1)",
    "JavaScript://ada.dev/%0Aalert(1)",
    "data:text/html,<p>hi</p>",
    "mailto:ada@example.com",
    "ftp://ada.dev",
    "https:/ada.dev",
  ])("refuses %j", (value) => {
    expect(normalizeProfileLinkUrl(value)).toBeUndefined();
  });
});

describe("isHttpProfileLinkUrl", () => {
  it("accepts only absolute http and https URLs", () => {
    expect(isHttpProfileLinkUrl("https://ada.dev")).toBe(true);
    expect(isHttpProfileLinkUrl("http://ada.dev")).toBe(true);
    expect(isHttpProfileLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpProfileLinkUrl("ada.dev")).toBe(false);
  });
});

describe("formatProfileLinkLabel", () => {
  it("shows the short, schemeless form", () => {
    expect(formatProfileLinkLabel("https://www.linkedin.com/in/ada/")).toBe("linkedin.com/in/ada");
    expect(formatProfileLinkLabel("https://ada.dev/")).toBe("ada.dev");
    expect(formatProfileLinkLabel("http://ada.dev:8080/cv?lang=en")).toBe(
      "ada.dev:8080/cv?lang=en",
    );
  });
});

describe("profileLinkKey", () => {
  it("ignores scheme, www, case, and trailing slashes", () => {
    expect(profileLinkKey("https://www.GitHub.com/ada/")).toBe(
      profileLinkKey("http://github.com/ada"),
    );
  });

  it("stays linear on a long run of slashes that does not end the URL", () => {
    const url = `https://ada.dev/${"/".repeat(250_000)}a`;
    const started = performance.now();

    profileLinkKey(url);
    formatProfileLinkLabel(url);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe("normalizeProfileLinks", () => {
  it("reads typed and legacy entries in order and drops what it cannot render", () => {
    expect(
      normalizeProfileLinks([
        { kind: "portfolio", url: " https://ada.dev/work " },
        "https://www.linkedin.com/in/ada",
        { kind: "hologram", url: "https://github.com/ada" },
        { kind: "website" },
        { kind: "website", url: "javascript:alert(1)" },
        "",
        null,
        42,
        "https://linkedin.com/in/ada/",
      ]),
    ).toEqual([
      { kind: "portfolio", url: "https://ada.dev/work" },
      { kind: "linkedin", url: "https://www.linkedin.com/in/ada" },
      { kind: "github", url: "https://github.com/ada" },
    ]);
  });

  it("returns an empty list for anything other than a list, and keeps at most ten", () => {
    expect(normalizeProfileLinks("https://ada.dev")).toEqual([]);
    expect(normalizeProfileLinks(undefined)).toEqual([]);
    const many = Array.from({ length: 12 }, (_value, index) => `https://ada${index}.dev`);
    expect(normalizeProfileLinks(many)).toHaveLength(10);
  });
});
