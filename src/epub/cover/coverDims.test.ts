import { describe, expect, it } from 'vitest';
import {
  acceptsEmbeddedCover,
  coverRatio,
  fitLongEdge,
  isReasonableCoverRatio,
  scoreEmbeddedCover,
} from './coverDims.ts';

describe('fitLongEdge', () => {
  it('never upscales a small source', () => {
    expect(fitLongEdge(600, 900, 1600)).toEqual({ w: 600, h: 900, scaled: false });
  });

  it('scales down to the target long edge, preserving aspect', () => {
    const out = fitLongEdge(2000, 3200, 1600);
    expect(out.scaled).toBe(true);
    expect(out.h).toBe(1600);
    expect(out.w).toBe(1000);
  });

  it('caps total pixels even when the long edge would allow more', () => {
    const out = fitLongEdge(6000, 6000, 2560);
    expect(out.w * out.h).toBeLessThanOrEqual(4_000_000);
  });
});

describe('cover ratio', () => {
  it('accepts the KDP 1.6:1 ideal', () => {
    expect(coverRatio(1600, 2560)).toBeCloseTo(1.6);
    expect(isReasonableCoverRatio(1600, 2560)).toBe(true);
  });

  it('rejects a square or a very tall page', () => {
    expect(isReasonableCoverRatio(1000, 1000)).toBe(false);
    expect(isReasonableCoverRatio(1000, 3000)).toBe(false);
  });
});

describe('scoreEmbeddedCover', () => {
  it('accepts a full-page, high-resolution, book-shaped page-1 image', () => {
    const score = scoreEmbeddedCover({ coverage: 0.98, w: 1600, h: 2560, page: 0, mime: 'image/jpeg' });
    expect(acceptsEmbeddedCover(score, 1600, 2560)).toBe(true);
  });

  it('rejects a small decorative image', () => {
    const score = scoreEmbeddedCover({ coverage: 0.1, w: 200, h: 200, page: 0, mime: 'image/png' });
    expect(acceptsEmbeddedCover(score, 200, 200)).toBe(false);
  });

  it('rejects a full-page image that is too low-resolution to be a cover', () => {
    const score = scoreEmbeddedCover({ coverage: 0.95, w: 400, h: 640, page: 0, mime: 'image/jpeg' });
    expect(acceptsEmbeddedCover(score, 400, 640)).toBe(false);
  });

  it('prefers page 1 over a later page', () => {
    const base = { coverage: 0.95, w: 1600, h: 2560, mime: 'image/jpeg' };
    expect(scoreEmbeddedCover({ ...base, page: 0 })).toBeGreaterThan(
      scoreEmbeddedCover({ ...base, page: 3 }),
    );
  });
});
