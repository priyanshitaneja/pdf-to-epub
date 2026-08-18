import type { Rect } from '../types/document.ts';

export type Matrix = [number, number, number, number, number, number];

/**
 * Multiply two 2D affine matrices in pdf.js's `[a, b, c, d, e, f]` convention.
 *
 * Equivalent to `Util.transform`, reimplemented here so the geometry helpers stay pure and
 * testable without importing pdf.js into the test path.
 */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Effective rendered glyph height, in points.
 *
 * This is the length of the transformed vertical unit vector, not the raw font size: a text
 * matrix can scale text independently of the font size it declares, so the declared size is
 * not what the reader sees.
 */
export function effectiveEm(m: Matrix): number {
  return Math.hypot(m[2], m[3]);
}

/** Effective horizontal scale, used to convert declared advances into points. */
export function effectiveHScale(m: Matrix): number {
  return Math.hypot(m[0], m[1]);
}

/**
 * True when the text matrix rotates or skews the run relative to the page.
 *
 * Rotated text has to be excluded from line clustering - a sideways table header or a
 * diagonal watermark clustered by baseline would drag unrelated glyphs into the same "line"
 * and scramble the surrounding paragraphs. Such regions get snapshotted instead.
 */
export function isSkewed(m: Matrix): boolean {
  const scale = Math.abs(m[0]);
  return Math.abs(m[1]) > 0.1 * Math.max(scale, 1e-6);
}

/**
 * Convert a pdf.js text-item transform into canonical page space.
 *
 * pdf.js gives text transforms in PDF user space: y-up, origin bottom-left, with page
 * `/Rotate` not applied. Composing with the viewport transform (from
 * `page.getViewport({ scale: 1 })`) yields y-down, origin top-left, rotation applied - the
 * one space every downstream stage assumes.
 */
export function toCanonical(
  viewportTransform: Matrix,
  itemTransform: Matrix,
  width: number,
  height: number,
): { rect: Rect; baselineY: number; em: number; skewed: boolean } {
  const m = multiply(viewportTransform, itemTransform);
  const em = effectiveEm(m);

  // `width` from pdf.js is ALREADY in viewport units, not text-space units, so it must not be
  // scaled again. Verified empirically: a run measured at 46pt between its own x and the next
  // run's x was reported as 400pt when multiplied by the horizontal scale — off by exactly the
  // em factor. Scaling here silently corrupts every gap measurement downstream.
  const advance = width;

  const x = m[4];
  const baselineY = m[5];

  // `height` from pdf.js is the item's declared height; fall back to the effective em when it
  // is zero, which happens for some Type3 and synthetic fonts.
  const h = height !== 0 ? Math.abs(height * em) : em;

  return {
    // In y-down space the baseline is at the bottom of the glyph box, so the box top is the
    // baseline minus the ascent. Using the full em as ascent slightly over-reaches, which is
    // the safe direction for line clustering.
    rect: { x, y: baselineY - h, w: advance, h },
    baselineY,
    em,
    skewed: isSkewed(m),
  };
}

export function unionRect(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Fraction of `inner`'s horizontal extent that lies within `outer`. */
export function horizontalOverlapRatio(inner: Rect, outer: Rect): number {
  if (inner.w <= 0) return 0;
  const left = Math.max(inner.x, outer.x);
  const right = Math.min(inner.x + inner.w, outer.x + outer.w);
  return Math.max(0, right - left) / inner.w;
}
