import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { CoverCandidate } from '../types/document.ts';
import { sampleDoc } from '../epub/__fixtures__/sampleDoc.ts';
import { writeSolidPng } from '../epub/cover/writePng.ts';
import { rebuildEpub } from './rebuildEpub.ts';

/**
 * A cover candidate shaped like one a user upload produces.
 *
 * PNG rather than the JPEG `coverFromFile` emits, because `writeSolidPng` is the only real encoder
 * available in Node. What matters here is that `ResolvedCover` is format-agnostic, which is exactly
 * why the upload path needed no change to `buildEpub`.
 */
function uploadedCover(rgb: [number, number, number]): CoverCandidate {
  const png = writeSolidPng(1600, 2560, rgb);
  return {
    source: 'user-upload',
    blob: new Blob([png as unknown as BlobPart], { type: 'image/png' }),
    mime: 'image/png',
    w: 1600,
    h: 2560,
    lossless: false,
    score: 100,
  };
}

const META = { title: 'Swapped Cover', author: 'A Person, B Person', language: 'en' };

describe('rebuildEpub', () => {
  it('produces a valid EPUB from an already-extracted model', async () => {
    const result = await rebuildEpub({
      model: sampleDoc(),
      cover: uploadedCover([20, 40, 80]),
      meta: META,
    });

    const errors = result.validation.issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
    expect(result.validation.ok).toBe(true);
  });

  it('writes both cover declarations, which is the point of the tool', async () => {
    const result = await rebuildEpub({
      model: sampleDoc(),
      cover: uploadedCover([20, 40, 80]),
      meta: META,
    });

    const zip = await JSZip.loadAsync(result.blob);
    const opfPath = Object.keys(zip.files).find((p) => p.endsWith('.opf'));
    const opf = await zip.file(opfPath!)!.async('string');

    // EPUB 3, and the EPUB 2 element Kindle actually reads.
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toMatch(/<meta name="cover" content="[^"]+"\s*\/>/);
  });

  it('embeds the cover it was handed, not the one the pipeline chose', async () => {
    const first = await rebuildEpub({
      model: sampleDoc(),
      cover: uploadedCover([10, 10, 10]),
      meta: META,
    });
    const second = await rebuildEpub({
      model: sampleDoc(),
      cover: uploadedCover([250, 250, 250]),
      meta: META,
    });

    const read = async (blob: Blob) => {
      const zip = await JSZip.loadAsync(blob);
      const path = Object.keys(zip.files).find((p) => /images\/cover\./.test(p));
      return zip.file(path!)!.async('uint8array');
    };

    const [dark, light] = [await read(first.blob), await read(second.blob)];
    expect(dark).not.toEqual(light);
  });

  it('applies edited metadata, so the Kindle library shows the right thing', async () => {
    const result = await rebuildEpub({
      model: sampleDoc(),
      cover: uploadedCover([20, 40, 80]),
      meta: META,
    });

    const zip = await JSZip.loadAsync(result.blob);
    const opfPath = Object.keys(zip.files).find((p) => p.endsWith('.opf'));
    const opf = await zip.file(opfPath!)!.async('string');

    expect(opf).toContain('Swapped Cover');
    // Comma-separated authors become separate creators.
    expect(opf).toContain('A Person');
    expect(opf).toContain('B Person');
    expect(result.filename).toBe('Swapped Cover - A Person.epub');
  });

  it('keeps the identifier stable, so a rebuild is not a second book in the library', async () => {
    const model = sampleDoc();
    const a = await rebuildEpub({ model, cover: uploadedCover([1, 2, 3]), meta: META });
    const b = await rebuildEpub({ model, cover: uploadedCover([4, 5, 6]), meta: META });

    const identifier = async (blob: Blob) => {
      const zip = await JSZip.loadAsync(blob);
      const opfPath = Object.keys(zip.files).find((p) => p.endsWith('.opf'));
      const opf = await zip.file(opfPath!)!.async('string');
      return /<dc:identifier[^>]*>([^<]+)</.exec(opf)?.[1];
    };

    expect(await identifier(a.blob)).toBe(await identifier(b.blob));
  });

  it('falls back to the model title when the user clears the field', async () => {
    const result = await rebuildEpub({
      model: sampleDoc(),
      cover: uploadedCover([20, 40, 80]),
      meta: { title: '   ', author: '', language: 'en' },
    });

    const zip = await JSZip.loadAsync(result.blob);
    const opfPath = Object.keys(zip.files).find((p) => p.endsWith('.opf'));
    const opf = await zip.file(opfPath!)!.async('string');

    // The fixture title carries an ampersand and smart quotes, so this pins the XML escaping too.
    expect(opf).toContain('A Test Document \u2014 \u20b91Cr &amp; \u201cBeyond\u201d');
  });
});
