import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Point pdf.js at its worker.
 *
 * Imported with `?url` so Vite fingerprints and serves it; no copy plugin needed for the
 * worker itself. The cMaps and standard fonts below are a different matter - those are plain
 * data files pdf.js fetches at runtime, and they are copied by vite-plugin-static-copy.
 */
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Without these two, CJK text and any PDF relying on the 14 standard fonts extract as garbage.
 * Easy to miss, because a Latin-only test file works fine without them.
 *
 * Built from `BASE_URL` rather than hardcoded to `/`, so the app works both at a domain root
 * (Vercel) and under a sub-path (GitHub Pages serves this repo from `/pdf-to-epub/`). An absolute
 * `/pdfjs/...` would 404 under a sub-path, and pdf.js reacts to a failed cMap fetch by silently
 * producing garbled text rather than raising — the same failure mode that has already appeared
 * twice in this project.
 */
const BASE = import.meta.env.BASE_URL;
const CMAP_URL = `${BASE}pdfjs/cmaps/`;
const STANDARD_FONTS_URL = `${BASE}pdfjs/standard_fonts/`;

export type PdfDocument = pdfjs.PDFDocumentProxy;

export interface LoadedPdf {
  doc: PdfDocument;
  /** Releases the worker and its buffers. Always call this, including on the error path. */
  destroy(): Promise<void>;
}

export async function loadPdf(data: ArrayBuffer): Promise<LoadedPdf> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
    // Fetch only what each page needs rather than pulling the whole file eagerly. Matters for
    // large scanned books, where eager fetch means holding the entire document in memory.
    disableAutoFetch: true,
  });

  const doc = await task.promise;
  return {
    doc,
    destroy: async () => {
      await task.destroy();
    },
  };
}

/** Human-readable message for the failures worth distinguishing. */
export function describeLoadError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const message = err instanceof Error ? err.message : String(err);

  if (name === 'PasswordException') {
    return 'This PDF is password-protected. Remove the password and try again.';
  }
  if (name === 'InvalidPDFException') {
    return 'This file is not a valid PDF, or it is damaged.';
  }
  return `Could not read the PDF: ${message}`;
}
