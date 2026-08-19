/**
 * Kindle/KDP's ideal cover is 1600x2560 - a 1.6:1 height-to-width ratio.
 *
 * We target that resolution but deliberately do NOT crop or letterbox real artwork to reach
 * the ratio: Kindle scales covers correctly, and cropping destroys the top or bottom of a
 * real book cover. Anything outside the tolerance below is surfaced as a note in the UI
 * instead.
 */
export const COVER_LONG_EDGE_DEFAULT = 1600;
export const COVER_LONG_EDGE_HIGH = 2560;
export const COVER_MAX_LONG_EDGE = 2560;
export const COVER_MAX_PIXELS = 4_000_000;

/** Above this size a cover is re-encoded at lower quality rather than embedded as-is. */
export const COVER_MAX_BYTES = 2 * 1024 * 1024;

export const COVER_RATIO_MIN = 1.25;
export const COVER_RATIO_MAX = 1.9;

export function coverRatio(w: number, h: number): number {
  return w === 0 ? 0 : h / w;
}

export function isReasonableCoverRatio(w: number, h: number): boolean {
  const r = coverRatio(w, h);
  return r >= COVER_RATIO_MIN && r <= COVER_RATIO_MAX;
}

/**
 * Scale dimensions to fit the target long edge without ever upscaling.
 *
 * Upscaling a small embedded cover just makes a blurry larger file, so a source smaller than
 * the target keeps its native size and the UI notes the low resolution.
 */
export function fitLongEdge(
  w: number,
  h: number,
  targetLongEdge: number,
): { w: number; h: number; scaled: boolean } {
  const longEdge = Math.max(w, h);
  if (longEdge <= targetLongEdge) return { w, h, scaled: false };

  let scale = targetLongEdge / longEdge;
  if (w * scale * h * scale > COVER_MAX_PIXELS) {
    scale = Math.sqrt(COVER_MAX_PIXELS / (w * h));
  }
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), scaled: true };
}

/** Score an embedded image XObject as a cover candidate. Higher is better. */
export function scoreEmbeddedCover(input: {
  coverage: number;
  w: number;
  h: number;
  page: number;
  mime: string;
}): number {
  const longEdge = Math.max(input.w, input.h);
  let score = input.coverage * 100;
  score += Math.min(longEdge, 3000) / 100;
  if (isReasonableCoverRatio(input.w, input.h)) score += 25;
  if (input.page > 0) score -= 15;
  if (input.mime === 'image/gif') score -= 20;
  return score;
}

export const EMBEDDED_COVER_MIN_SCORE = 90;
export const EMBEDDED_COVER_MIN_LONG_EDGE = 800;
export const EMBEDDED_COVER_MIN_PIXELS = 400_000;

export function acceptsEmbeddedCover(score: number, w: number, h: number): boolean {
  return (
    score >= EMBEDDED_COVER_MIN_SCORE &&
    Math.max(w, h) >= EMBEDDED_COVER_MIN_LONG_EDGE &&
    w * h >= EMBEDDED_COVER_MIN_PIXELS
  );
}
