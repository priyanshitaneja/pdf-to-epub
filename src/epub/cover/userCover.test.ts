import { afterEach, describe, expect, it, vi } from 'vitest';
import { USER_COVER_MAX_BYTES, coverFromFile } from './userCover.ts';
import { COVER_MAX_PIXELS } from './coverDims.ts';

/**
 * jsdom has neither `createImageBitmap` nor a real 2D context, so the decode and the encode are
 * both stubbed. What is under test is the decision-making around them: what gets rejected, what
 * dimensions come out, and that the result always claims JPEG.
 */
function stubBitmap(width: number, height: number): void {
  vi.stubGlobal('createImageBitmap', async () => ({ width, height, close() {} }));
}

vi.mock('./synthesizeCover.ts', () => ({
  makeCanvas: (w: number, h: number) => ({
    width: w,
    height: h,
    getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
  }),
  canvasToBlob: async () => new Blob([new Uint8Array(64)], { type: 'image/jpeg' }),
}));

function file(name: string, type: string, bytes: Uint8Array<ArrayBuffer> | number): File {
  const data: Uint8Array<ArrayBuffer> =
    typeof bytes === 'number' ? new Uint8Array(bytes) : bytes;
  return new File([data], name, { type });
}

/** Minimal valid PNG header, enough for probeImage to identify the format. */
function pngBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(24);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  out.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(out.buffer).setUint32(16, width);
  new DataView(out.buffer).setUint32(20, height);
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('coverFromFile', () => {
  it('rejects a file over the size limit before decoding it', async () => {
    const oversized = file('huge.jpg', 'image/jpeg', USER_COVER_MAX_BYTES + 1);
    await expect(coverFromFile(oversized)).rejects.toThrow(/limit for a cover image/);
  });

  it('rejects SVG by reported type, explaining why', async () => {
    const svg = file('art.svg', 'image/svg+xml', 32);
    await expect(coverFromFile(svg)).rejects.toThrow(/SVG cannot be used as a cover/);
  });

  it('rejects SVG by extension even when the type is missing', async () => {
    await expect(coverFromFile(file('art.svg', '', 32))).rejects.toThrow(/SVG/);
  });

  it('sniffs SVG out of the bytes when the name and type both lie', async () => {
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await expect(coverFromFile(file('art.png', 'image/png', bytes))).rejects.toThrow(/SVG/);
  });

  it('does not mistake a real PNG for SVG', async () => {
    stubBitmap(1600, 2560);
    const cover = await coverFromFile(file('cover.png', 'image/png', pngBytes(1600, 2560)));
    expect(cover.source).toBe('user-upload');
  });

  it('rejects an image too small for the validator to accept', async () => {
    stubBitmap(80, 120);
    await expect(coverFromFile(file('tiny.jpg', 'image/jpeg', 64))).rejects.toThrow(
      /at least 100 on each edge/,
    );
  });

  it('always reports JPEG, so the manifest cannot disagree with the bytes', async () => {
    stubBitmap(1200, 1600);
    const cover = await coverFromFile(file('cover.png', 'image/png', pngBytes(1200, 1600)));
    expect(cover.mime).toBe('image/jpeg');
    expect(cover.lossless).toBe(false);
  });

  it('leaves a small image at its own size rather than upscaling', async () => {
    stubBitmap(600, 900);
    const cover = await coverFromFile(file('small.jpg', 'image/jpeg', 64));
    expect(cover.w).toBe(600);
    expect(cover.h).toBe(900);
  });

  it('scales an oversized image down to the recommended long edge', async () => {
    stubBitmap(4000, 6400);
    const cover = await coverFromFile(file('big.jpg', 'image/jpeg', 64));
    expect(Math.max(cover.w, cover.h)).toBeLessThanOrEqual(2560);
    expect(cover.w * cover.h).toBeLessThanOrEqual(COVER_MAX_PIXELS);
    // Aspect preserved: 4000x6400 is 1:1.6.
    expect(cover.h / cover.w).toBeCloseTo(1.6, 2);
  });

  it('outranks every generated candidate, so an explicit choice wins', async () => {
    stubBitmap(1600, 2560);
    const cover = await coverFromFile(file('cover.jpg', 'image/jpeg', 64));
    // renderPageCover scores 50; synthesizeCover scores below that.
    expect(cover.score).toBeGreaterThan(50);
  });

  it('reports a readable error when the bytes are not a decodable image', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('decode failed');
    });
    await expect(coverFromFile(file('broken.jpg', 'image/jpeg', 64))).rejects.toThrow(
      /could not be read as an image/,
    );
  });
});
