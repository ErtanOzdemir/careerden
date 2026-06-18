import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DocxPdfRenderer } from "@link2cv/domain";

const execFileAsync = promisify(execFile);

export class LibreOfficeDocxPdfRenderer implements DocxPdfRenderer {
  constructor(private readonly binaries = ["soffice", "libreoffice"]) {}

  async docxToPdf(docx: Buffer): Promise<Buffer> {
    const workDir = await mkdtemp(join(tmpdir(), "link2cv-docx-"));
    const inputPath = join(workDir, "cv.docx");
    const outputPath = join(workDir, "cv.pdf");

    try {
      await writeFile(inputPath, docx);
      await this.convertWithAvailableBinary(inputPath, workDir);
      return await readFile(outputPath);
    } finally {
      await rm(workDir, { force: true, recursive: true });
    }
  }

  private async convertWithAvailableBinary(inputPath: string, outputDir: string): Promise<void> {
    const errors: string[] = [];

    for (const binary of this.binaries) {
      try {
        await execFileAsync(binary, [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          outputDir,
          inputPath,
        ]);
        return;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(
      `DOCX to PDF conversion failed. Install LibreOffice and ensure soffice or libreoffice is on PATH. ${errors.join(" ")}`,
    );
  }
}
