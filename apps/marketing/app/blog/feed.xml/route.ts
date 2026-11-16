import { blogDescription, blogFeedPath, blogPath, blogTitle, getBlogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

// Prerendered with the pages, so the feed changes only when a build adds or edits a post.
export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): Response {
  const items = getBlogPosts()
    .map((post) => {
      const url = escapeXml(absoluteUrl(post.path));
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <description>${escapeXml(post.description)}</description>`,
        `      <pubDate>${new Date(`${post.publishedAt}T00:00:00Z`).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(blogTitle)}</title>`,
    `    <link>${escapeXml(absoluteUrl(blogPath))}</link>`,
    `    <description>${escapeXml(blogDescription)}</description>`,
    "    <language>en</language>",
    `    <atom:link href="${escapeXml(absoluteUrl(blogFeedPath))}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(feed, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
