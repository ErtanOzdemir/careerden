import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatBlogDate, getBlogPosts } from "@/lib/blog";
import { siteUrl } from "@/lib/site";
import BlogPostPage, { generateMetadata, generateStaticParams } from "./[slug]/page";
import { GET as getFeed } from "./feed.xml/route";
import BlogIndexPage, { metadata } from "./page";

const [post] = getBlogPosts();
const postUrl = new URL(post.path, siteUrl).toString();

describe("blog pages", () => {
  it("lists every post with a link to it and advertises the feed", () => {
    render(<BlogIndexPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Careerden Blog" })).toBeVisible();
    for (const { title, path } of getBlogPosts()) {
      expect(screen.getByRole("link", { name: title })).toHaveAttribute("href", path);
    }
    expect(metadata.alternates).toMatchObject({
      canonical: new URL("/blog", siteUrl).toString(),
      types: { "application/rss+xml": new URL("/blog/feed.xml", siteUrl).toString() },
    });
  });

  it("prerenders one page per post with article metadata and structured data", async () => {
    const params = Promise.resolve({ slug: post.slug });

    expect(generateStaticParams()).toEqual(getBlogPosts().map(({ slug }) => ({ slug })));
    expect(await generateMetadata({ params })).toMatchObject({
      title: { absolute: `${post.title} | Careerden` },
      alternates: { canonical: postUrl },
      openGraph: { type: "article", publishedTime: post.publishedAt },
    });

    const { container } = render(await BlogPostPage({ params }));

    expect(screen.getByRole("heading", { level: 1, name: post.title })).toBeVisible();
    expect(screen.getByText(formatBlogDate(post.publishedAt))).toBeVisible();
    expect(screen.getByRole("link", { name: /All posts/ })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: /Download Careerden/ })).toHaveAttribute(
      "href",
      "/download",
    );
    const jsonLd = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(jsonLd?.textContent ?? "{}")).toMatchObject({
      "@type": "BlogPosting",
      headline: post.title,
      url: postUrl,
      datePublished: post.publishedAt,
    });
  });

  it("serves an RSS feed with an item per post", async () => {
    const response = getFeed();
    const feed = new DOMParser().parseFromString(await response.text(), "application/xml");

    expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
    expect(feed.querySelector("parsererror")).toBeNull();
    expect(feed.querySelectorAll("item")).toHaveLength(getBlogPosts().length);
    expect(feed.querySelector("item > link")?.textContent).toBe(postUrl);
    expect(feed.querySelector("item > title")?.textContent).toBe(post.title);
  });
});
