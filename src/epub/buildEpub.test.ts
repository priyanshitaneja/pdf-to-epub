import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { base64ToBytes, sampleDoc } from './__fixtures__/sampleDoc.ts';
import { buildEpub, type ResolvedCover } from './buildEpub.ts';
import { epubFilename } from './filename.ts';
import { EPUB_BANNED_CSS, STYLE_CSS } from './templates/styleCss.ts';

/** A 4x4 JPEG, so the cover magic-byte check has something real to sniff. */
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDIzM//bAEMBCQkJDAsMGA0NGDIhHCEyMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMv/AABEIAAQABAMBIgAC' +
  'EQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAAB' +
  'fQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5' +
  'OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeo' +
  'qaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQAC' +
  'EQMRAD8A9/8A/9k=';

function coverFixture(): ResolvedCover {
  return {
    blob: new Blob([base64ToBytes(TINY_JPEG_BASE64) as unknown as BlobPart], { type: 'image/jpeg' }),
    mime: 'image/jpeg',
    w: 1600,
    h: 2560,
  };
}

const BUILD_OPTS = {
  cover: coverFixture(),
  now: new Date('2026-08-18T12:00:00Z'),
  uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
};

async function build() {
  return buildEpub(sampleDoc(), { ...BUILD_OPTS, cover: coverFixture() });
}

async function entries(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(blob);
}

describe('buildEpub', () => {
  it('produces an EPUB that passes its own validator with no errors', async () => {
    const result = await build();
    const errors = result.validation.issues.filter((i) => i.severity === 'error');
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
    expect(result.validation.ok).toBe(true);
  });

  it('writes mimetype as the first entry, stored uncompressed', async () => {
    const { blob } = await build();
    const head = new Uint8Array(await blob.slice(0, 58).arrayBuffer());
    const u16 = (o: number) => head[o]! | (head[o + 1]! << 8);

    expect([head[0], head[1], head[2], head[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(u16(6)).toBe(0); // no data descriptor
    expect(u16(8)).toBe(0); // STORED
    expect(u16(26)).toBe(8); // filename length "mimetype"
    expect(u16(28)).toBe(0); // empty extra field
    expect(new TextDecoder().decode(head.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(head.subarray(38, 58))).toBe('application/epub+zip');
  });

  it('declares the cover both ways, which is the whole point', async () => {
    const { blob } = await build();
    const opf = await (await entries(blob)).file('OEBPS/content.opf')!.async('string');

    // EPUB2: unprefixed, inside <metadata>. This is the one Kindle reads.
    expect(opf).toContain('<meta name="cover" content="cover-img"/>');
    expect(opf).not.toMatch(/<opf:meta\s+name="cover"/);
    // EPUB3: on the manifest item.
    expect(opf).toContain('properties="cover-image"');
    // Plus the legacy guide reference and spine position 0.
    expect(opf).toContain('<reference type="cover" title="Cover" href="cover.xhtml"/>');
    expect(opf.indexOf('<itemref idref="cover"')).toBeLessThan(opf.indexOf('<itemref idref="nav"'));
  });

  it('emits a cover page whose SVG viewBox matches the real image dimensions', async () => {
    const { blob } = await build();
    const cover = await (await entries(blob)).file('OEBPS/cover.xhtml')!.async('string');
    expect(cover).toContain('viewBox="0 0 1600 2560"');
    expect(cover).toContain('xlink:href="images/cover.jpg"');
    // The cover page must not pull in the shared stylesheet, or it inherits body margins.
    expect(cover).not.toContain('style.css');
  });

  it('declares properties="svg" on the cover page when using SVG markup', async () => {
    const svg = await buildEpub(sampleDoc(), { ...BUILD_OPTS, cover: coverFixture(), coverMarkup: 'svg' });
    const svgOpf = await (await entries(svg.blob)).file('OEBPS/content.opf')!.async('string');
    expect(svgOpf).toContain('href="cover.xhtml" media-type="application/xhtml+xml" properties="svg"');

    const img = await buildEpub(sampleDoc(), { ...BUILD_OPTS, cover: coverFixture(), coverMarkup: 'img' });
    const imgOpf = await (await entries(img.blob)).file('OEBPS/content.opf')!.async('string');
    expect(imgOpf).toContain('href="cover.xhtml" media-type="application/xhtml+xml"/>');
    const imgCover = await (await entries(img.blob)).file('OEBPS/cover.xhtml')!.async('string');
    expect(imgCover).toContain('<img src="images/cover.jpg"');
  });

  it('ships both nav.xhtml and toc.ncx', async () => {
    const { blob } = await build();
    const zip = await entries(blob);
    expect(zip.file('OEBPS/nav.xhtml')).not.toBeNull();
    expect(zip.file('OEBPS/toc.ncx')).not.toBeNull();

    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('properties="nav"');
    expect(opf).toContain('<spine toc="ncx">');

    const ncx = await zip.file('OEBPS/toc.ncx')!.async('string');
    // playOrder is a single document-wide counter, so it must be strictly increasing.
    const orders = [...ncx.matchAll(/playOrder="(\d+)"/g)].map((m) => Number(m[1]));
    expect(orders.length).toBeGreaterThan(1);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('emits a dcterms:modified with no milliseconds', async () => {
    const { blob } = await build();
    const opf = await (await entries(blob)).file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<meta property="dcterms:modified">2026-08-18T12:00:00Z</meta>');
  });

  it('keeps every asset it declares, and declares every asset it keeps', async () => {
    const { blob } = await build();
    const zip = await entries(blob);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    const hrefs = [...opf.matchAll(/href="(images\/[^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(1); // cover + at least one figure
    for (const href of hrefs) {
      expect(zip.file(`OEBPS/${href}`), `missing ${href}`).not.toBeNull();
    }
  });

  it('is byte-for-byte deterministic across builds', async () => {
    const a = await build();
    const b = await build();
    const [ba, bb] = [new Uint8Array(await a.blob.arrayBuffer()), new Uint8Array(await b.blob.arrayBuffer())];
    expect(ba.length).toBe(bb.length);
    expect(Array.from(ba.subarray(0, 4096))).toEqual(Array.from(bb.subarray(0, 4096)));
  });

  it('honours metadata overrides from the UI', async () => {
    const result = await buildEpub(sampleDoc(), {
      ...BUILD_OPTS,
      cover: coverFixture(),
      metaOverrides: { title: 'Renamed Book', authors: ['A. Author'], language: 'fr' },
    });
    const opf = await (await entries(result.blob)).file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<dc:title>Renamed Book</dc:title>');
    expect(opf).toContain('<dc:creator id="creator-0">A. Author</dc:creator>');
    expect(opf).toContain('<dc:language>fr</dc:language>');
    expect(result.filename).toBe('Renamed Book - A. Author.epub');
  });

  it('resolves the fixture internal link across the chapter split', async () => {
    const { blob, chapters } = await build();
    const zip = await entries(blob);
    let found = false;
    for (const chapter of chapters) {
      const xhtml = await zip.file(`OEBPS/${chapter.href}`)!.async('string');
      if (/<a href="(ch\d+\.xhtml)?#h-ch-results">to the results<\/a>/.test(xhtml)) found = true;
    }
    expect(found, 'internal link should resolve to the Results heading anchor').toBe(true);
  });
});

describe('style.css', () => {
  it('contains none of the properties Kindle mishandles', () => {
    const normalized = STYLE_CSS.replace(/\s+/g, '');
    for (const banned of EPUB_BANNED_CSS) {
      expect(normalized, `stylesheet must not use ${banned}`).not.toContain(banned.replace(/\s+/g, ''));
    }
  });

  it('uses no absolute font sizes, so the reader can still resize text', () => {
    expect(STYLE_CSS).not.toMatch(/font-size:\s*\d+(\.\d+)?(px|pt)/);
  });

  it('keeps images inside the screen', () => {
    expect(STYLE_CSS).toMatch(/img\s*\{[^}]*max-width:\s*100%/);
  });
});

describe('epubFilename', () => {
  it('combines title and author', () => {
    expect(epubFilename('Book', ['Jane Roe'], 'x.pdf')).toBe('Book - Jane Roe.epub');
  });

  it('keeps non-ASCII, which is safe in a download filename', () => {
    expect(epubFilename('₹1Cr Roadmap', [], 'x.pdf')).toBe('₹1Cr Roadmap.epub');
  });

  it('strips path separators and other illegal characters', () => {
    expect(epubFilename('a/b:c*d?e', [], 'x.pdf')).toBe('abcde.epub');
  });

  it('falls back to the source filename, then to a constant', () => {
    expect(epubFilename('', [], 'My Paper.pdf')).toBe('My Paper.epub');
    expect(epubFilename('', [], '')).toBe('converted.epub');
  });
});
