import { describe, expect, it } from 'vitest';
import {
  effectiveHScale,
  effectiveEm,
  horizontalOverlapRatio,
  isSkewed,
  multiply,
  toCanonical,
  unionRect,
  type Matrix,
} from './geometry.ts';

/** The viewport transform pdf.js produces for an unrotated page of the given height. */
function uprightViewport(pageHeight: number): Matrix {
  return [1, 0, 0, -1, 0, pageHeight];
}

describe('multiply', () => {
  it('leaves a matrix unchanged when composed with the identity', () => {
    const m: Matrix = [2, 0, 0, 3, 10, 20];
    expect(multiply([1, 0, 0, 1, 0, 0], m)).toEqual(m);
  });
});

describe('toCanonical', () => {
  it('flips PDF y-up coordinates into y-down page space', () => {
    // A glyph sitting 700pt up a 792pt page is 92pt from the top.
    const item: Matrix = [12, 0, 0, 12, 100, 700];
    const out = toCanonical(uprightViewport(792), item, 1, 1);
    expect(out.baselineY).toBe(92);
    expect(out.rect.x).toBe(100);
    expect(out.em).toBe(12);
  });

  it('reports the rendered em, not the declared font size', () => {
    // A 10pt font scaled 2x by the text matrix renders at 20pt.
    const item: Matrix = [20, 0, 0, 20, 0, 100];
    expect(toCanonical(uprightViewport(792), item, 1, 1).em).toBe(20);
  });

  it('takes the advance from pdf.js verbatim, without rescaling it', () => {
    // pdf.js reports `width` already in viewport units. Multiplying by the horizontal scale
    // inflates it by the em factor and corrupts every downstream gap measurement, which is
    // exactly the bug this asserts against.
    const item: Matrix = [12, 0, 0, 12, 0, 100];
    expect(toCanonical(uprightViewport(792), item, 46.4, 1).rect.w).toBeCloseTo(46.4);
  });

  it('places the box top above the baseline', () => {
    const item: Matrix = [12, 0, 0, 12, 0, 700];
    const out = toCanonical(uprightViewport(792), item, 1, 1);
    expect(out.rect.y).toBeLessThan(out.baselineY);
  });
});

describe('isSkewed', () => {
  it('accepts upright text', () => {
    expect(isSkewed([12, 0, 0, 12, 0, 0])).toBe(false);
  });

  it('flags rotated text', () => {
    expect(isSkewed([0, 12, -12, 0, 0, 0])).toBe(true);
  });

  it('tolerates the slight skew italic synthesis produces', () => {
    expect(isSkewed([12, 0.5, 0, 12, 0, 0])).toBe(false);
  });
});

describe('effectiveHScale', () => {
  it('measures the transformed horizontal unit vector', () => {
    expect(effectiveHScale([10, 0, 0, 10, 0, 0])).toBe(10);
  });
});

describe('effectiveEm', () => {
  it('measures the transformed vertical unit vector', () => {
    expect(effectiveEm([10, 0, 0, 10, 0, 0])).toBe(10);
    expect(effectiveEm([0, 10, -10, 0, 0, 0])).toBe(10);
  });
});

describe('unionRect', () => {
  it('covers all inputs', () => {
    expect(unionRect([
      { x: 10, y: 10, w: 10, h: 10 },
      { x: 30, y: 5, w: 10, h: 10 },
    ])).toEqual({ x: 10, y: 5, w: 30, h: 15 });
  });

  it('returns an empty rect for no input', () => {
    expect(unionRect([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('horizontalOverlapRatio', () => {
  it('is 1 when fully contained', () => {
    expect(horizontalOverlapRatio({ x: 10, y: 0, w: 10, h: 1 }, { x: 0, y: 0, w: 100, h: 1 })).toBe(1);
  });

  it('is 0 when disjoint', () => {
    expect(horizontalOverlapRatio({ x: 200, y: 0, w: 10, h: 1 }, { x: 0, y: 0, w: 100, h: 1 })).toBe(0);
  });

  it('is a fraction when partially overlapping', () => {
    expect(horizontalOverlapRatio({ x: 95, y: 0, w: 10, h: 1 }, { x: 0, y: 0, w: 100, h: 1 })).toBeCloseTo(0.5);
  });
});
