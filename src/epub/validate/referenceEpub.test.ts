import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateEpub } from './validateEpub.ts';

/**
 * Golden test against a real, known-good EPUB that already displays correctly on a Kindle.
 *
 * The point is to check the validator against something other than our own output: if it
 * only ever sees files this project generated, a shared misunderstanding of the spec would
 * go unnoticed. This file is the counterexample.
 *
 * It lives outside the repository on purpose — it is a personal document, and this repo has
 * a collaborator. The test resolves it by absolute path and skips when it is not there, so
 * a fresh clone still passes.
 */
const REFERENCE_EPUB = '/Users/priyanshi/Documents/personal/Frontend-Staff-Roadmap-24-Weeks.epub';

async function loadReference(): Promise<Blob | null> {
  try {
    const bytes = await readFile(REFERENCE_EPUB);
    return new Blob([bytes as unknown as BlobPart], { type: 'application/epub+zip' });
  } catch {
    return null;
  }
}

describe('validator vs. the known-good reference EPUB', async () => {
  const blob = await loadReference();

  it.skipIf(blob === null)('finds no errors in a file known to work on a Kindle', async () => {
    const result = await validateEpub(blob!);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  });

  it.skipIf(blob === null)('confirms the reference declares its cover both ways', async () => {
    const result = await validateEpub(blob!);
    const coverCodes = result.issues
      .filter((i) => i.code.startsWith('cover'))
      .map((i) => i.code);
    expect(coverCodes).not.toContain('cover-meta-missing');
    expect(coverCodes).not.toContain('cover-image-property-missing');
  });

  it.skipIf(blob === null)('reports the one thing the reference is missing: a guide reference', async () => {
    // This is the documented improvement our generator makes over the reference, so it is
    // asserted rather than merely observed. If the reference ever gains a <guide>, this test
    // fails loudly and the claim gets revisited.
    const result = await validateEpub(blob!);
    expect(result.issues.map((i) => i.code)).toContain('guide-cover-missing');
  });
});
