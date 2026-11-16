import type { Metadata } from "next";
import Link from "next/link";
import {
  blogDescription,
  blogFeedPath,
  blogPath,
  blogTitle,
  formatBlogDate,
  getBlogPosts,
} from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl } from "@/lib/site";

const baseMetadata = pageMetadata({
  title: "Blog",
  description: blogDescription,
  path: blogPath,
});

export const metadata: Metadata = {
  ...baseMetadata,
  alternates: {
    ...baseMetadata.alternates,
    types: { "application/rss+xml": absoluteUrl(blogFeedPath) },
  },
};

export default function BlogIndexPage() {
  const posts = getBlogPosts();

  return (
    <main id="main-content" className="blog-main">
      <div className="container blog-container">
        <header className="blog-header">
          <span className="kicker">Blog</span>
          <h1>{blogTitle}</h1>
          <p>{blogDescription}</p>
        </header>
        {posts.length === 0 ? (
          <p className="blog-empty">No posts yet. Check back soon.</p>
        ) : (
          <ul className="blog-list">
            {posts.map((post) => (
              <li key={post.slug}>
                <article>
                  <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
                  <h2>
                    <Link href={post.path}>{post.title}</Link>
                  </h2>
                  <p>{post.description}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
