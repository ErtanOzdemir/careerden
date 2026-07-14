import { describe, expect, it, vi } from "vitest";
import { GotenbergDocxPdfRenderer } from "./gotenberg-docx-pdf-renderer.js";

describe("GotenbergDocxPdfRenderer", () => {
  it("posts the DOCX to Gotenberg and returns the converted PDF", async () => {
    const pdf = Buffer.from("%PDF-1.7\nrendered-pdf");
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) =>
      Promise.resolve(
        new Response(pdf, {
          headers: { "content-type": "application/pdf" },
          status: 200,
        }),
      ),
    );
    const renderer = new GotenbergDocxPdfRenderer({
      baseUrl: "http://gotenberg:3000/",
      fetcher,
      timeoutMs: 5_000,
    });
    const docx = Buffer.from("docx-content");

    await expect(renderer.docxToPdf(docx)).resolves.toEqual(pdf);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://gotenberg:3000/forms/libreoffice/convert");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const form = init.body as FormData;
    const uploaded = form.get("files");
    expect(uploaded).toBeInstanceOf(Blob);
    expect((uploaded as File).name).toBe("document.docx");
    expect(Buffer.from(await (uploaded as Blob).arrayBuffer())).toEqual(docx);
  });

  it("includes the Gotenberg response when conversion fails", async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) =>
      Promise.resolve(new Response("conversion unavailable", { status: 503 })),
    );
    const renderer = new GotenbergDocxPdfRenderer({
      baseUrl: "http://localhost:3002",
      fetcher,
    });

    await expect(renderer.docxToPdf(Buffer.from("docx"))).rejects.toThrow(
      "Gotenberg DOCX to PDF conversion failed at http://localhost:3002/forms/libreoffice/convert: HTTP 503: conversion unavailable",
    );
  });

  it("rejects an empty conversion response", async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) =>
      Promise.resolve(new Response(new Uint8Array(), { status: 200 })),
    );
    const renderer = new GotenbergDocxPdfRenderer({
      baseUrl: "http://localhost:3002",
      fetcher,
    });

    await expect(renderer.docxToPdf(Buffer.from("docx"))).rejects.toThrow(
      "Gotenberg returned an empty PDF",
    );
  });
});
