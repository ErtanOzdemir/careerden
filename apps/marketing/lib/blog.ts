import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

// Blog posts are Markdown files in content/blog, named after their slug. They are read only
// while Next.js prerenders, so the running service never touches the file system for them.

export type BlogPost = {
  slug: string;
  path: `/blog/${string}`;
  title: string;
  description: string;
  /** ISO calendar date, for example 2026-11-16. */
  publishedAt: string;
  updatedAt?: string;
  /** Rendered from repository-owned Markdown, so it is trusted markup. */
  html: string;
};

export class BlogPostFormatError extends Error {
  constructor(
    readonly slug: string,
    readonly problem: string,
  ) {
    super(`Blog post "${slug}": ${problem}`);
    this.name = "BlogPostFormatError";
  }
}

export const blogPath = "/blog";
export const blogFeedPath = "/blog/feed.xml";
export const blogTitle = "Careerden Blog";
export const blogDescription =
  "Practical guides on tailoring CVs, writing cover letters, and running an organized job search, from the team behind Careerden.";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const contentDirectory = path.join(process.cwd(), "content", "blog");

function requiredText(slug: string, data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new BlogPostFormatError(slug, `front matter "${key}" must be a non-empty string`);
  }
  return value.trim();
}

function calendarDate(slug: string, key: string, value: unknown): string {
  // YAML turns an unquoted 2026-11-16 into a Date at midnight UTC.
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (
    typeof text !== "string" ||
    !datePattern.test(text) ||
    Number.isNaN(Date.parse(`${text}T00:00:00Z`))
  ) {
    throw new BlogPostFormatError(slug, `front matter "${key}" must be a YYYY-MM-DD date`);
  }
  return text;
}

export function parseBlogPost(slug: string, source: string): BlogPost {
  if (!slugPattern.test(slug)) {
    throw new BlogPostFormatError(slug, "file name must be lowercase words joined by hyphens");
  }
  const { content, data } = matter(source);
  const publishedAt = calendarDate(slug, "publishedAt", data.publishedAt);
  const updatedAt =
    data.updatedAt === undefined ? undefined : calendarDate(slug, "updatedAt", data.updatedAt);
  if (updatedAt !== undefined && updatedAt < publishedAt) {
    throw new BlogPostFormatError(slug, 'front matter "updatedAt" is before "publishedAt"');
  }
  if (content.trim() === "") {
    throw new BlogPostFormatError(slug, "post body is empty");
  }
  return {
    slug,
    path: `/blog/${slug}`,
    title: requiredText(slug, data, "title"),
    description: requiredText(slug, data, "description"),
    publishedAt,
    ...(updatedAt === undefined ? {} : { updatedAt }),
    html: marked.parse(content, { async: false }),
  };
}

let cachedPosts: readonly BlogPost[] | undefined;

/** Every post, newest first. */
export function getBlogPosts(): readonly BlogPost[] {
  cachedPosts ??= readdirSync(contentDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) =>
      parseBlogPost(
        fileName.slice(0, -".md".length),
        readFileSync(path.join(contentDirectory, fileName), "utf8"),
      ),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
  return cachedPosts;
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return getBlogPosts().find((post) => post.slug === slug);
}

const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export function formatBlogDate(date: string): string {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}
