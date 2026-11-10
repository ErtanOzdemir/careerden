export type CvFileKind = "pdf" | "docx" | "text";

export interface CvFile {
  kind: CvFileKind;
  body: Buffer;
}

// Reads the plain text of an uploaded CV. The file is never stored; only its text reaches the AI.
export interface CvTextExtractor {
  extract(file: CvFile): Promise<string>;
}

/**
 * The CV could not be read: `unopenable` for a damaged, encrypted, or mislabelled file, and
 * `no_text` for one without a text layer, usually a scanned image.
 */
export class CvTextUnreadableError extends Error {
  constructor(readonly reason: "unopenable" | "no_text") {
    super(reason === "no_text" ? "The CV has no text layer" : "The CV file could not be opened");
    this.name = "CvTextUnreadableError";
  }
}
