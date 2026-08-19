import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildEpub } from '../epub/buildEpub.ts';
import { extractDocument } from './extractDocument.ts';
import type { PdfDocument } from '../pdf/loadDocument.ts';
import { writeSolidPng } from '../epub/cover/writePng.ts';

/**
 * The M2 acceptance test: a real PDF all the way to a validated EPUB.
 *
 * This is the whole pipeline except the browser-only parts — the cover is supplied directly,
 * because rendering a page needs canvas. Everything else is the production path: real pdf.js,
 * real extraction, real splitter, real writer, real validator.
 *
 * The fixtures are personal documents that live outside the repo, so the test resolves them by
 * absolute path and skips when absent.
 */
const FIXTURE = '/Users/priyanshi/Documents/personal/Frontend-Staff-Roadmap-24-Weeks.pdf';

/** A real 1600x2560 cover, matching what the browser path produces. */
function coverFixture() {
  const png = writeSolidPng(1600, 2560, [28, 46, 84]);
  return {
    blob: new Blob([png as unknown as BlobPart], { type: 'image/png' }),
    mime: 'image/png' as const,
    w: 1600,
    h: 2560,
  };
}

async function loadFixture(): Promise<{ doc: PdfDocument; destroy: () => Promise<void> } | null> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(FIXTURE));
  } catch {
    return null;
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  const doc = (await task.promise) as unknown as PdfDocument;
  return { doc, destroy: async () => void (await task.destroy()) };
}

describe('real PDF to EPUB, end to end', async () => {
  const available = await (async () => {
    try {
      await readFile(FIXTURE);
      return true;
    } catch {
      return false;
    }
  })();

  it.skipIf(!available)('extracts a document model with real structure', async () => {
    const loaded = (await loadFixture())!;
    try {
      const model = await extractDocument(loaded.doc, { fileName: 'roadmap.pdf' });

      expect(model.meta.sourcePageCount).toBe(21);
      expect(model.blocks.length).toBeGreaterThan(50);
      expect(model.report.tierByPage).toHaveLength(21);

      // Real headings must be found, or the TOC would be empty.
      const headings = model.blocks.filter((b) => b.kind === 'h');
      expect(headings.length).toBeGreaterThan(3);
      expect(model.toc.length).toBeGreaterThan(0);

      // And real prose.
      const paragraphs = model.blocks.filter((b) => b.kind === 'p');
      expect(paragraphs.length).toBeGreaterThan(20);

      // A title better than the filename should have been recovered.
      expect(model.meta.title.length).toBeGreaterThan(3);
      expect(model.meta.titleSource).not.toBe('filename');
    } finally {
      await loaded.destroy();
    }
  }, 60_000);

  it.skipIf(!available)('builds a valid EPUB from it with no errors', async () => {
    const loaded = (await loadFixture())!;
    try {
      const model = await extractDocument(loaded.doc, { fileName: 'roadmap.pdf' });
      const result = await buildEpub(model, {
        cover: coverFixture(),
        now: new Date('2026-08-18T12:00:00Z'),
        uuid: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
      });

      const errors = result.validation.issues.filter((i) => i.severity === 'error');
      expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);

      // Both cover declarations must survive the real pipeline, not just the fixture one.
      const zip = await JSZip.loadAsync(result.blob);
      const opf = await zip.file('OEBPS/content.opf')!.async('string');
      expect(opf).toContain('<meta name="cover" content="cover-img"/>');
      expect(opf).toContain('properties="cover-image"');

      // Multiple chapters means the splitter found real heading structure.
      expect(result.chapters.length).toBeGreaterThan(1);

      // Spot-check that readable text actually made it into a chapter.
      const firstChapter = await zip.file(`OEBPS/${result.chapters[0]!.href}`)!.async('string');
      const words = firstChapter.replace(/<[^>]+>/g, ' ').split(/\s+/).filter((w) => /^[A-Za-z]{3,}$/.test(w));
      expect(words.length).toBeGreaterThan(20);
    } finally {
      await loaded.destroy();
    }
  }, 60_000);

  it.skipIf(!available)('does not lose text between extraction and the EPUB', async () => {
    const loaded = (await loadFixture())!;
    try {
      const model = await extractDocument(loaded.doc, { fileName: 'roadmap.pdf' });
      const result = await buildEpub(model, { cover: coverFixture() });

      const zip = await JSZip.loadAsync(result.blob);
      let emitted = 0;
      for (const chapter of result.chapters) {
        const xhtml = await zip.file(`OEBPS/${chapter.href}`)!.async('string');
        emitted += xhtml.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
      }

      const extracted = model.blocks
        .filter((b) => b.kind === 'p' || b.kind === 'h')
        .flatMap((b) => (b.kind === 'p' || b.kind === 'h' ? b.inlines : []))
        .map((i) => (i.t === 'text' ? i.s : ''))
        .join('')
        .replace(/\s+/g, '').length;

      expect(extracted).toBeGreaterThan(1000);
      // Allow for entity escaping inflating the count, but nothing should vanish.
      expect(emitted).toBeGreaterThanOrEqual(extracted * 0.95);
    } finally {
      await loaded.destroy();
    }
  }, 60_000);
});

describe('document-wide heading structure', async () => {
  const available = await (async () => {
    try {
      await readFile(FIXTURE);
      return true;
    } catch {
      return false;
    }
  })();

  it.skipIf(!available)('recovers the document real module structure, not a flat pile', async () => {
    const loaded = (await loadFixture())!;
    try {
      const model = await extractDocument(loaded.doc, { fileName: 'roadmap.pdf' });
      const result = await buildEpub(model, { cover: coverFixture() });

      // Deciding heading levels per page produced 137 headings and 32 chapters for this 21-page
      // document, because the numbering-vs-size decision flipped from page to page. Deciding it
      // document-wide gives ~25 headings and ~10 chapters, which is the real structure. These
      // bounds are deliberately loose but would catch a regression to per-page behaviour.
      const headings = model.blocks.filter((b) => b.kind === 'h');
      expect(headings.length).toBeLessThan(60);
      expect(result.chapters.length).toBeLessThan(20);
      expect(result.chapters.length).toBeGreaterThan(3);

      // The chapters should be the document's modules and phases.
      const titles = result.chapters.map((c) => c.title).join(' | ');
      expect(titles).toMatch(/MODULE/i);

      // No chapter should be a near-empty stub, which is what a wrapped heading used to create.
      const zip = await JSZip.loadAsync(result.blob);
      for (const chapter of result.chapters) {
        const xhtml = await zip.file(`OEBPS/${chapter.href}`)!.async('string');
        const body = xhtml.slice(xhtml.indexOf('<body'));
        const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        expect(text.length, `chapter ${chapter.href} is a stub: ${text.slice(0, 80)}`).toBeGreaterThan(100);
      }
    } finally {
      await loaded.destroy();
    }
  }, 60_000);
});
