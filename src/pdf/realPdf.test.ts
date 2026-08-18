import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { assembleLines } from '../extract/tierB/lines.ts';
import { createThresholdCache } from '../extract/tierB/glyphJoin.ts';
import { stripCellBreaks } from '../extract/types.ts';
import { textContentToRuns, type PdfTextContentItem } from './textToRuns.ts';
import type { Matrix } from './geometry.ts';

/**
 * Integration test against the user's real PDFs.
 *
 * These are the documents that motivated the project, and they are the M1-X acceptance
 * criterion: text must come out with correct word spacing rather than `2 4 - W E E K`.
 *
 * They live outside the repository because they are personal documents and this repo has a
 * collaborator, so the test resolves them by absolute path and skips when absent. That keeps a
 * fresh clone green without ever committing the files.
 */
const FIXTURES = [
  '/Users/priyanshi/Documents/personal/Frontend-Staff-Roadmap-24-Weeks.pdf',
  '/Users/priyanshi/Documents/personal/career-plan-1cr-staff-frontend.pdf',
];

async function extractPageText(path: string, pageNumber: number): Promise<string[] | null> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(path));
  } catch {
    return null;
  }

  // The legacy build is the one that runs under Node without a DOM.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    // Silence the font warnings that would otherwise flood the test output.
    verbosity: 0,
  });
  const doc = await loadingTask.promise;

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({ includeMarkedContent: true });

  const { runs } = textContentToRuns(
    content.items as unknown as PdfTextContentItem[],
    content.styles as Record<string, { fontFamily?: string }>,
    viewport.transform as Matrix,
  );

  const { lines } = assembleLines(runs, createThresholdCache());
  // destroy() lives on the loading task, not the document proxy.
  await loadingTask.destroy();
  return lines.map((l) => stripCellBreaks(l.text)).filter((t) => t.length > 0);
}

describe('real PDF extraction', async () => {
  const available: string[] = [];
  for (const path of FIXTURES) {
    try {
      await readFile(path);
      available.push(path);
    } catch {
      /* not present */
    }
  }

  it.skipIf(available.length === 0)('extracts page 1 with correct word spacing', async () => {
    const lines = await extractPageText(available[0]!, 1);
    expect(lines).not.toBeNull();
    expect(lines!.length).toBeGreaterThan(0);

    const joined = lines!.join('\n');

    // The regression this whole module exists to prevent: runs of single characters separated
    // by spaces. Allow a couple of legitimate ones (initials, "A B testing") but not a pattern.
    const overSplit = joined.match(/\b\w \w \w \w\b/g) ?? [];
    expect(overSplit, `over-split text found: ${overSplit.slice(0, 5).join(' | ')}`).toHaveLength(0);

    // Real words must be present and intact.
    const words = joined.split(/\s+/).filter((w) => /^[A-Za-z]{2,}$/.test(w));
    expect(words.length).toBeGreaterThan(10);

    // Average token length on a page of English prose is well above 2.
    const tokens = joined.split(/\s+/).filter((t) => t.length > 0);
    const avgLen = tokens.reduce((n, t) => n + t.length, 0) / tokens.length;
    expect(avgLen).toBeGreaterThan(2.5);
  }, 30_000);

  it.skipIf(available.length === 0)('recovers the document title from the first page', async () => {
    const lines = await extractPageText(available[0]!, 1);
    const joined = lines!.join(' ');
    // Both fixtures are roadmap/career documents whose first page carries these words.
    expect(joined.toLowerCase()).toMatch(/roadmap|frontend|staff|week/);
  }, 30_000);

  it.skipIf(available.length < 2)('handles the second fixture too', async () => {
    const lines = await extractPageText(available[1]!, 1);
    expect(lines!.length).toBeGreaterThan(0);
    const overSplit = (lines!.join('\n').match(/\b\w \w \w \w\b/g) ?? []).length;
    expect(overSplit).toBe(0);
  }, 30_000);
});
