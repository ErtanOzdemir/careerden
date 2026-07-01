import { describe, expect, it } from "vitest";
import {
  htmlToLinkedInJobDescriptionText,
  sanitizeLinkedInJobDescriptionHtml,
} from "./linkedin-job.scraper.js";

describe("extractLinkedInJobDescription", () => {
  it("captures sanitized display HTML and plain text from the LinkedIn description", async () => {
    const html = `
      <h2>About the role</h2>
      <p>Build <strong>TypeScript</strong> services.</p>
      <ul>
        <li>Own APIs</li>
        <li><a href="https://example.com/team" data-tracking-control-name="x">Meet the team</a></li>
      </ul>
      <button>Show more</button>
      <script>window.evil = true</script>
      <p onclick="alert('x')">Ship safely</p>
    `;

    const sanitizedHtml = sanitizeLinkedInJobDescriptionHtml(html);

    expect(htmlToLinkedInJobDescriptionText(html)).toBe(
      "About the role\nBuild TypeScript services.\nOwn APIs\nMeet the team\nShip safely",
    );
    expect(sanitizedHtml).toBe(
      '<h2>About the role</h2><p>Build <strong>TypeScript</strong> services.</p><ul><li>Own APIs</li><li><a href="https://example.com/team">Meet the team</a></li></ul><p>Ship safely</p>',
    );
  });

  it("drops unsafe links while preserving their text", async () => {
    const html = `
      <p><a href="javascript:alert('x')">Apply here</a></p>
    `;

    expect(htmlToLinkedInJobDescriptionText(html)).toBe("Apply here");
    expect(sanitizeLinkedInJobDescriptionHtml(html)).toBe("<p>Apply here</p>");
  });
});
