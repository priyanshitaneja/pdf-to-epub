import { describe, expect, it } from 'vitest';
import { probeImage } from './imageProbe.ts';
import { writeSolidPng } from '../cover/writePng.ts';

describe('probeImage', () => {
  it('reads dimensions from a real PNG', () => {
    const png = writeSolidPng(1600, 2560, [20, 40, 80]);
    expect(probeImage(png)).toEqual({ mime: 'image/png', width: 1600, height: 2560 });
  });

  it('rejects a bare PNG signature with no image data', () => {
    // This exact 8-byte value shipped as the cover of a generated EPUB and Kindle showed nothing.
    // A magic-byte check accepts it; a header parse must not.
    const signatureOnly = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(probeImage(signatureOnly)).toBeNull();
  });

  it('rejects a PNG whose first chunk is not IHDR', () => {
    const png = writeSolidPng(8, 8, [0, 0, 0]);
    const corrupted = new Uint8Array(png);
    corrupted[13] = 0x58; // 'IHDR' -> 'IXDR'
    expect(probeImage(corrupted)).toBeNull();
  });

  it('reads dimensions from a JPEG via its SOF marker', () => {
    // Minimal JPEG: SOI, then a SOF0 declaring 2560 high by 1600 wide.
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x0a, 0x00, 0x06, 0x40,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    ]);
    expect(probeImage(jpeg)).toEqual({ mime: 'image/jpeg', width: 1600, height: 2560 });
  });

  it('reads dimensions from a GIF header', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x06, 0x00, 0x0a]);
    expect(probeImage(gif)).toEqual({ mime: 'image/gif', width: 1600, height: 2560 });
  });

  it('returns null for arbitrary bytes', () => {
    expect(probeImage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
  });

  it('returns null for an empty buffer', () => {
    expect(probeImage(new Uint8Array(0))).toBeNull();
  });
});

describe('writeSolidPng', () => {
  it('produces a PNG that round-trips through the probe', () => {
    const png = writeSolidPng(120, 200, [255, 0, 0]);
    expect(probeImage(png)?.width).toBe(120);
    expect(probeImage(png)?.height).toBe(200);
    // Real image data, not just headers.
    expect(png.length).toBeGreaterThan(100);
  });
});
