import { describe, expect, it } from "vitest";
import {
  BlogPostFormatError,
  formatBlogDate,
  getBlogPost,
  getBlogPosts,
  parseBlogPost,
} from "./blog";

const source = `---
title: A post
description: What the post covers.
publishedAt: "2026-11-16"
---

## Heading

Body with a [link](/download).
`;

describe("blog posts", () => {
  it("parses front matter and renders the Markdown body", () => {
    const post = parseBlogPost("a-post", source);

    expect(post).toMatchObject({
      slug: "a-post",
      path: "/blog/a-post",
      title: "A post",
      description: "What the post covers.",
      publishedAt: "2026-11-16",
    });
    expect(post.updatedAt).toBeUndefined();
    expect(post.html).toContain("<h2>Heading</h2>");
    expect(post.html).toContain('<a href="/download">link</a>');
  });

  it("accepts unquoted YAML dates and an update date", () => {
    const post = parseBlogPost(
      "a-post",
      source.replace('"2026-11-16"', "2026-11-16\nupdatedAt: 2026-12-01"),
    );

    expect(post).toMatchObject({ publishedAt: "2026-11-16", updatedAt: "2026-12-01" });
  });

  it.each([
    ["a file name with underscores", "a_post", source, /file name/],
    ["a missing title", "a-post", source.replace(/title: .*\n/, ""), /title/],
    ["an uppercase file name", "A-Post", source, /file name/],
    ["a missing description", "a-post", source.replace(/description: .*\n/, ""), /description/],
    ["an invalid date", "a-post", source.replace("2026-11-16", "16 November"), /publishedAt/],
    ["an impossible date", "a-post", source.replace("2026-11-16", "2026-13-40"), /publishedAt/],
    [
      "an update before publication",
      "a-post",
      source.replace('"2026-11-16"', '"2026-11-16"\nupdatedAt: "2026-11-01"'),
      /updatedAt/,
    ],
    ["an empty body", "a-post", source.slice(0, source.lastIndexOf("---") + 3), /body is empty/],
  ])("rejects %s", (_case, slug, text, problem) => {
    expect(() => parseBlogPost(slug, text)).toThrow(BlogPostFormatError);
    expect(() => parseBlogPost(slug, text)).toThrow(problem);
  });

  it("loads every post in content/blog, newest first, with unique slugs", () => {
    const posts = getBlogPosts();

    expect(posts.length).toBeGreaterThan(0);
    expect(new Set(posts.map((post) => post.slug)).size).toBe(posts.length);
    expect(posts.map((post) => post.publishedAt)).toEqual(
      posts.map((post) => post.publishedAt).sort((a, b) => b.localeCompare(a)),
    );
    expect(getBlogPost(posts[0].slug)).toBe(posts[0]);
    expect(getBlogPost("not-a-post")).toBeUndefined();
  });

  it("keeps search-result descriptions within a displayable length", () => {
    for (const post of getBlogPosts()) {
      expect(post.description.length, post.slug).toBeLessThanOrEqual(160);
    }
  });

  it("formats calendar dates without shifting them across time zones", () => {
    expect(formatBlogDate("2026-11-16")).toBe("November 16, 2026");
  });
});
