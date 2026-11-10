import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { CvTextUnreadableError } from "../../domain/profiles/cv-text-extractor.js";
import { DocumentCvTextExtractor } from "./document-cv-text-extractor.js";

const extractor = new DocumentCvTextExtractor();

describe("DocumentCvTextExtractor", () => {
  it("reads the text and link targets of a PDF", async () => {
    const text = await extractor.extract({
      kind: "pdf",
      body: minimalPdf("Ada Lovelace", "https://github.com/ada"),
    });

    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Links in the document:\nhttps://github.com/ada");
  });

  it("reads paragraphs, headers, and external links of a DOCX", async () => {
    const text = await extractor.extract({
      kind: "docx",
      body: docx({
        "word/document.xml": wordDocument(
          '<w:p><w:r><w:t>Engineer at R&amp;D</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Built </w:t></w:r><w:r><w:t>engines</w:t></w:r></w:p>',
        ),
        "word/header1.xml": wordDocument("<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>"),
        "word/_rels/document.xml.rels":
          '<Relationships><Relationship Id="rId1" Type="hyperlink" Target="https://linkedin.com/in/ada" TargetMode="External"/><Relationship Id="rId2" Type="styles" Target="styles.xml"/></Relationships>',
      }),
    });

    expect(text).toBe(
      "Ada Lovelace\n\n\nEngineer at R&D\nBuilt engines\n\n\nLinks in the document:\nhttps://linkedin.com/in/ada",
    );
  });

  it("rejects files it cannot open", async () => {
    await expect(
      extractor.extract({ kind: "pdf", body: Buffer.from("%PDF-1.4 broken") }),
    ).rejects.toEqual(new CvTextUnreadableError("unopenable"));
    await expect(
      extractor.extract({ kind: "docx", body: docx({ "readme.txt": "not a document" }) }),
    ).rejects.toEqual(new CvTextUnreadableError("unopenable"));
  });
});

function docx(files: Record<string, string>): Buffer {
  return Buffer.from(
    zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)]))),
  );
}

function wordDocument(body: string): string {
  return `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

// A one-page PDF with one line of text and one link annotation, with a valid cross-reference table.
function minimalPdf(text: string, link: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> /Annots [6 0 R] >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Type /Annot /Subtype /Link /Rect [72 710 200 730] /A << /S /URI /URI (${link}) >> >>`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
