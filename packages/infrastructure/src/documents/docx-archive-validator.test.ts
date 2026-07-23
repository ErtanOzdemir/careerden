import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { InvalidDocxTemplateError } from "@careerden/domain";
import { validateDocxArchive } from "./docx-archive-validator.js";

describe("validateDocxArchive", () => {
  it("accepts a bounded DOCX archive with the required OOXML entries", () => {
    expect(() => validateDocxArchive(createDocx())).not.toThrow();
  });

  it("rejects archives missing a required OOXML entry", () => {
    const archive = createDocx({ includeDocument: false });

    expect(() => validateDocxArchive(archive)).toThrow(
      new InvalidDocxTemplateError(
        "Invalid DOCX template: required DOCX entry is missing: word/document.xml",
      ),
    );
  });

  it("rejects path traversal entries", () => {
    const zip = createDocxZip();
    zip.file("../outside.xml", "<outside/>");

    expect(() => validateDocxArchive(generate(zip))).toThrow(
      "Invalid DOCX template: archive contains an unsafe entry path",
    );
  });

  it("rejects entries with an excessive compression ratio", () => {
    const zip = createDocxZip();
    zip.file("word/large.xml", "A".repeat(2 * 1024 * 1024));

    expect(() => validateDocxArchive(generate(zip))).toThrow(
      "Invalid DOCX template: an entry exceeds the 200:1 compression ratio limit",
    );
  });

  it("rejects archives with too many entries", () => {
    const zip = createDocxZip();
    for (let index = 0; index < 510; index += 1) {
      zip.file(`word/items/${index}.xml`, "<item/>");
    }

    expect(() => validateDocxArchive(generate(zip))).toThrow(
      "Invalid DOCX template: archive must contain between 1 and 512 entries",
    );
  });
});

function createDocx(options: { includeDocument?: boolean } = {}): Buffer {
  return generate(createDocxZip(options));
}

function createDocxZip(options: { includeDocument?: boolean } = {}): PizZip {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.folder("_rels")?.file(".rels", "<Relationships/>");

  if (options.includeDocument !== false) {
    zip.folder("word")?.file("document.xml", "<w:document/>");
  }

  return zip;
}

function generate(zip: PizZip): Buffer {
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
