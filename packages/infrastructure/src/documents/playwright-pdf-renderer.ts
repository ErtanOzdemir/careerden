import type { DocumentRenderer } from "@careerden/domain";

export class PlaywrightPdfRenderer implements DocumentRenderer {
  async htmlToPdf(html: string): Promise<Buffer> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      return await page.pdf({
        format: "A4",
        printBackground: true,
      });
    } finally {
      await browser.close();
    }
  }
}
