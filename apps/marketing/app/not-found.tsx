import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="status-page">
      <span className="kicker">404</span>
      <h1>That page is not here.</h1>
      <p>The link may be outdated, or the page may have moved.</p>
      <Link className="button button-primary" href="/">
        Back to Careerden
      </Link>
    </main>
  );
}
