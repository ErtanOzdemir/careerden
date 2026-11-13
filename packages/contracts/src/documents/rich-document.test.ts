import { describe, expect, it } from "vitest";
import {
  mergeRichDocumentsAsProse,
  richDocumentFromText,
  richDocumentToPlainText,
} from "./rich-document.js";

describe("mergeRichDocumentsAsProse", () => {
  it("drops sentences that repeat with different trailing punctuation", () => {
    const merged = mergeRichDocumentsAsProse(
      richDocumentFromText("Built the API!\nLed the team."),
      richDocumentFromText("Built the API.\nLed the team?!"),
    );

    expect(merged && richDocumentToPlainText(merged)).toBe("Built the API! Led the team.");
  });

  it("stays linear on a long run of punctuation that does not end the sentence", () => {
    const started = performance.now();

    mergeRichDocumentsAsProse(
      richDocumentFromText("First."),
      richDocumentFromText(`${"!".repeat(250_000)}a`),
    );
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
