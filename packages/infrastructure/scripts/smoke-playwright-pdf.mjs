import process from "node:process";

import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body>Careerden PDF smoke test</body></html>");
  const pdf = await page.pdf({ format: "A4", printBackground: true });

  if (pdf.length === 0 || pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("Playwright PDF smoke test returned an invalid PDF");
  }

  process.stdout.write(`Playwright PDF smoke test passed (${pdf.length} bytes)\n`);
} finally {
  await browser.close();
}
