import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { blogPath, formatBlogDate, getBlogPost, getBlogPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { blogPostingJsonLd } from "@/lib/structured-data";

type BlogPostPageProps = { params: Promise<{ slug: string }> };

// Only the posts in content/blog exist; every other slug answers 404 without rendering.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getBlogPosts().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: post.path,
    article: { publishedAt: post.publishedAt, updatedAt: post.updatedAt },
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getBlogPost((await params).slug);
  if (!post) notFound();

  return (
    <main id="main-content" className="blog-main">
      <JsonLd data={blogPostingJsonLd(post)} />
      <div className="container blog-container">
        <Link className="blog-back" href={blogPath}>
          <ArrowLeft aria-hidden="true" /> All posts
        </Link>
        <article>
          <header className="blog-header">
            <h1>{post.title}</h1>
            <p>{post.description}</p>
            <p className="blog-meta">
              <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
              {post.updatedAt && post.updatedAt !== post.publishedAt ? (
                <>
                  {" · Updated "}
                  <time dateTime={post.updatedAt}>{formatBlogDate(post.updatedAt)}</time>
                </>
              ) : null}
            </p>
          </header>
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: post.html }} />
        </article>
        <aside className="blog-cta" aria-labelledby="blog-cta-title">
          <div>
            <h2 id="blog-cta-title">Keep your whole job search in one place.</h2>
            <p>
              Careerden Unplugged is a free, open-source desktop app that tracks applications and
              prepares tailored CV and cover-letter drafts on your own computer.
            </p>
          </div>
          <Link className="button button-primary button-large" href="/download">
            Download Careerden <ArrowRight aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
