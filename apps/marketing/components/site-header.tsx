import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Careerden home">
          <BrandMark />
          <span>Careerden</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/#application-tracking">Features</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#pricing">Pricing</Link>
        </nav>
        <Link className="button button-primary header-download" href="/download">
          Download
        </Link>
      </div>
    </header>
  );
}
