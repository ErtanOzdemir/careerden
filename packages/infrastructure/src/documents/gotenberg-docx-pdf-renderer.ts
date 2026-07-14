import type { DocxPdfRenderer } from "@link2cv/domain";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const libreOfficeConversionPath = "/forms/libreoffice/convert";

type GotenbergFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface GotenbergDocxPdfRendererOptions {
  baseUrl: string;
  fetcher?: GotenbergFetch;
  timeoutMs?: number;
}

export class GotenbergDocxPdfRenderer implements DocxPdfRenderer {
  private readonly endpoint: string;
  private readonly fetcher: GotenbergFetch;
  private readonly timeoutMs: number;

  constructor(options: GotenbergDocxPdfRendererOptions) {
    this.endpoint = `${options.baseUrl.replace(/\/+$/, "")}${libreOfficeConversionPath}`;
    this.fetcher = options.fetcher ?? ((url, init) => globalThis.fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async docxToPdf(docx: Buffer): Promise<Buffer> {
    const form = new FormData();
    form.append(
      "files",
      new Blob([Uint8Array.from(docx)], { type: docxContentType }),
      "document.docx",
    );

    try {
      const response = await this.fetcher(this.endpoint, {
        body: form,
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const responseBody = (await response.text()).trim().slice(0, 500);
        throw new Error(`HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`);
      }

      const pdf = Buffer.from(await response.arrayBuffer());
      if (pdf.length === 0) {
        throw new Error("Gotenberg returned an empty PDF");
      }

      return pdf;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Gotenberg DOCX to PDF conversion failed at ${this.endpoint}: ${message}`, {
        cause: error,
      });
    }
  }
}
