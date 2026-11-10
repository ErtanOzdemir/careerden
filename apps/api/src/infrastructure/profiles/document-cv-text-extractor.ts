import { unzipSync } from "fflate";
import { extractLinks, extractText, getDocumentProxy } from "unpdf";
import {
  CvTextUnreadableError,
  type CvFile,
  type CvTextExtractor,
} from "../../domain/profiles/cv-text-extractor.js";

// A DOCX is a zip archive; bound what we inflate so a crafted file cannot exhaust memory.
const maximumDocxEntrySize = 20 * 1024 * 1024;
const docxTextPart = /^word\/(document|header\d*|footer\d*)\.xml$/;
const docxRelationships = /^word\/_rels\/document\.xml\.rels$/;

/**
 * Extracts CV text locally with pdf.js (through unpdf) for PDFs and by reading the WordprocessingML
 * parts of a DOCX. Hyperlink targets are appended because CVs often show "LinkedIn" as the link
 * text and keep the actual URL only in the link.
 */
export class DocumentCvTextExtractor implements CvTextExtractor {
  async extract(file: CvFile): Promise<string> {
    switch (file.kind) {
      case "pdf":
        return extractPdfText(file.body);
      case "docx":
        return extractDocxText(file.body);
      case "text":
        return file.body.toString("utf8");
    }
  }
}

async function extractPdfText(body: Buffer): Promise<string> {
  let document: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js transfers the buffer it is given, so it receives a copy.
    document = await getDocumentProxy(new Uint8Array(body));
  } catch {
    throw new CvTextUnreadableError("unopenable");
  }

  try {
    const { text } = await extractText(document, { mergePages: true });
    const { links } = await extractLinks(document);
    return withLinks(text, links);
  } catch {
    throw new CvTextUnreadableError("unopenable");
  } finally {
    await document.destroy();
  }
}

function extractDocxText(body: Buffer): string {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(body), {
      filter: (entry) =>
        (docxTextPart.test(entry.name) || docxRelationships.test(entry.name)) &&
        entry.originalSize <= maximumDocxEntrySize,
    });
  } catch {
    throw new CvTextUnreadableError("unopenable");
  }

  const decoder = new TextDecoder();
  const main = entries["word/document.xml"];
  if (!main) throw new CvTextUnreadableError("unopenable");

  // Headers and footers first: CV templates often put the name and contact details there.
  const parts = Object.keys(entries)
    .filter((name) => docxTextPart.test(name) && name !== "word/document.xml")
    .sort()
    .map((name) => wordprocessingText(decoder.decode(entries[name])));
  parts.push(wordprocessingText(decoder.decode(main)));

  const relationships = entries["word/_rels/document.xml.rels"];
  const links = relationships ? externalLinks(decoder.decode(relationships)) : [];

  return withLinks(parts.join("\n\n"), links);
}

const wordprocessingToken =
  /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<\/w:p>/g;

function wordprocessingText(xml: string): string {
  let text = "";
  for (const match of xml.matchAll(wordprocessingToken)) {
    const [token, run] = match;
    if (run !== undefined) text += decodeXmlEntities(run);
    else if (token === "<w:tab/>") text += "\t";
    else text += "\n";
  }
  return text;
}

function externalLinks(xml: string): string[] {
  const links: string[] = [];
  for (const [relationship] of xml.matchAll(/<Relationship\s[^>]*>/g)) {
    if (!/TargetMode="External"/.test(relationship)) continue;
    const target = /Target="([^"]*)"/.exec(relationship)?.[1];
    if (target) links.push(decodeXmlEntities(target));
  }
  return links;
}

function withLinks(text: string, links: string[]): string {
  const webLinks = [...new Set(links.filter((link) => /^https?:\/\//i.test(link)))];
  return webLinks.length > 0 ? `${text}\n\nLinks in the document:\n${webLinks.join("\n")}` : text;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith("#x")) return safeCodePoint(Number.parseInt(lower.slice(2), 16), entity);
    if (lower.startsWith("#")) return safeCodePoint(Number.parseInt(lower.slice(1), 10), entity);
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[lower] ?? entity;
  });
}

function safeCodePoint(codePoint: number, fallback: string): string {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;
}
