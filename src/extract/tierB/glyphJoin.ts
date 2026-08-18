import { CELL_BREAK, type PositionedRun } from '../types.ts';

/**
 * Rejoin positioned runs into readable text.
 *
 * This is the highest-risk module in the project. PDF has no concept of a word — it places
 * glyphs at coordinates — so word boundaries must be recovered from the gaps between runs.
 * When a document uses CSS `letter-spacing` (the roadmap PDFs printed from Chrome do), pdf.js
 * emits one run per glyph and *every* gap is inflated, so a fixed threshold reads
 * `24-WEEK` as `2 4 - W E E K`.
 *
 * The fix is to calibrate the threshold per line from the line's own geometry rather than
 * assume a constant. Three sources, best available wins — see `calibrateThreshold`.
 */

/** Gaps below this fraction of an em are never a space, whatever calibration says. */
const MIN_SPACE_RATIO = 0.16;
/** Gaps at or above this fraction of an em are column separation, not a word space. */
const CELL_BREAK_RATIO = 1.2;
/** Fallback when a line offers no calibration signal. */
const DEFAULT_SPACE_RATIO = 0.25;

export interface JoinOptions {
  /** Reused across lines so short lines can borrow the body font's calibration. */
  cache?: ThresholdCache;
}

export type ThresholdCache = Map<string, number>;

export function createThresholdCache(): ThresholdCache {
  return new Map();
}

export interface JoinResult {
  text: string;
  /** True when the sanity check could not be satisfied even after retrying. */
  uncertain: boolean;
  /** Normalised threshold actually used, as a fraction of an em. Exposed for tests. */
  thresholdRatio: number;
}

/**
 * Join one line's runs into a string.
 *
 * Runs must already be in visual left-to-right order and belong to a single line.
 */
export function joinRuns(runs: PositionedRun[], options: JoinOptions = {}): JoinResult {
  const usable = runs.filter((r) => r.str.length > 0);
  if (usable.length === 0) return { text: '', uncertain: false, thresholdRatio: DEFAULT_SPACE_RATIO };
  if (usable.length === 1) {
    return { text: usable[0]!.str, uncertain: false, thresholdRatio: DEFAULT_SPACE_RATIO };
  }

  const cache = options.cache;
  const key = cacheKey(usable);

  let ratio = calibrateThreshold(usable) ?? cache?.get(key) ?? DEFAULT_SPACE_RATIO;
  let result = applyThreshold(usable, ratio);

  // Bounded retry. Two adjustments is enough to escape a bad calibration; more than that and
  // the line is genuinely ambiguous, which is worth reporting rather than guessing at.
  let attempts = 0;
  while (attempts < 2) {
    const verdict = sanityCheck(result.text);
    if (verdict === 'ok') break;
    ratio = verdict === 'too-low' ? ratio * 1.4 : ratio * 0.7;
    result = applyThreshold(usable, ratio);
    attempts += 1;
  }

  const uncertain = sanityCheck(result.text) !== 'ok';
  if (!uncertain && cache) cache.set(key, ratio);

  return { text: result.text, uncertain, thresholdRatio: ratio };
}

/** Group runs by font and size so calibration is not mixed across styles. */
function cacheKey(runs: PositionedRun[]): string {
  const first = runs[0]!;
  return `${first.fontKey}@${first.em.toFixed(1)}`;
}

function applyThreshold(runs: PositionedRun[], ratio: number): { text: string } {
  let text = runs[0]!.str;

  for (let i = 1; i < runs.length; i += 1) {
    const prev = runs[i - 1]!;
    const next = runs[i]!;
    const em = Math.max(prev.em, next.em) || 1;
    const gap = next.rect.x - (prev.rect.x + prev.advance);
    const normalized = gap / em;

    if (normalized >= CELL_BREAK_RATIO) {
      text += CELL_BREAK;
    } else if (normalized >= Math.max(ratio, MIN_SPACE_RATIO)) {
      // Do not double up if the PDF already contains an explicit space glyph.
      if (!text.endsWith(' ') && !next.str.startsWith(' ')) text += ' ';
    }
    text += next.str;
  }

  return { text };
}

/**
 * Derive a per-line space threshold, as a fraction of an em.
 *
 * Returns null when the line offers no usable signal, in which case the caller falls back to
 * the page cache and then to a constant.
 */
export function calibrateThreshold(runs: PositionedRun[]): number | null {
  return calibrateFromSpaceGlyphs(runs) ?? calibrateFromGapClusters(runs);
}

/**
 * Best case: the PDF emits explicit space glyphs.
 *
 * Their measured advance is the font's real space width, and the median gap between non-space
 * runs is the tracking. A threshold just under half a space above the tracking separates the
 * two cleanly.
 */
function calibrateFromSpaceGlyphs(runs: PositionedRun[]): number | null {
  const spaceAdvances: number[] = [];
  const trackingGaps: number[] = [];

  for (let i = 1; i < runs.length; i += 1) {
    const prev = runs[i - 1]!;
    const next = runs[i]!;
    const em = Math.max(prev.em, next.em) || 1;

    if (next.str === ' ' || prev.str === ' ') {
      const advance = (prev.str === ' ' ? prev.advance : next.advance) / em;
      if (advance > 0) spaceAdvances.push(advance);
      continue;
    }
    trackingGaps.push((next.rect.x - (prev.rect.x + prev.advance)) / em);
  }

  if (spaceAdvances.length === 0) return null;

  const space = median(spaceAdvances);
  const tracking = trackingGaps.length > 0 ? Math.max(0, median(trackingGaps)) : 0;
  return clampRatio(tracking + 0.45 * space);
}

/**
 * Fallback: split the line's gaps into two clusters with Otsu's method.
 *
 * On a letter-spaced line the gaps are strongly bimodal — a tight cluster of intra-word
 * tracking and a looser cluster of real word spaces. The low cluster's centre *is* the
 * letter-spacing value, which is exactly the signature that defeats a fixed threshold.
 *
 * The separation and mass guards matter: a line whose gaps are all similar (a single word, or
 * fully justified text with uniform spacing) has no meaningful split, and forcing one there
 * produces worse output than the default.
 */
function calibrateFromGapClusters(runs: PositionedRun[]): number | null {
  const gaps: number[] = [];
  for (let i = 1; i < runs.length; i += 1) {
    const prev = runs[i - 1]!;
    const next = runs[i]!;
    const em = Math.max(prev.em, next.em) || 1;
    const g = (next.rect.x - (prev.rect.x + prev.advance)) / em;
    // Discard negative kerning and absurd outliers before clustering.
    if (g >= -0.05 && g <= 3) gaps.push(g);
  }

  if (gaps.length < 6) return null;

  const sorted = [...gaps].sort((a, b) => a - b);
  const split = otsuSplit(sorted);
  if (split === null) return null;

  const low = sorted.slice(0, split);
  const high = sorted.slice(split);
  if (low.length === 0 || high.length === 0) return null;

  const centerLow = mean(low);
  const centerHigh = mean(high);

  // The two clusters must be genuinely distinct...
  if (centerHigh - centerLow < 0.2) return null;
  // ...and the tight cluster must hold most of the gaps, as it would inside words.
  if (low.length / sorted.length < 0.4) return null;

  return clampRatio((centerLow + centerHigh) / 2);
}

/**
 * One-dimensional Otsu threshold over a sorted array.
 *
 * Returns the index where the array should be split to maximise between-class variance, or
 * null if no split separates anything.
 */
function otsuSplit(sorted: number[]): number | null {
  const n = sorted.length;
  if (n < 2) return null;

  const total = sorted.reduce((a, b) => a + b, 0);
  let bestIndex: number | null = null;
  let bestVariance = -1;
  let sumLow = 0;

  for (let i = 1; i < n; i += 1) {
    sumLow += sorted[i - 1]!;
    const wLow = i / n;
    const wHigh = 1 - wLow;
    const meanLow = sumLow / i;
    const meanHigh = (total - sumLow) / (n - i);
    const variance = wLow * wHigh * (meanLow - meanHigh) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestIndex = i;
    }
  }

  return bestVariance > 0 ? bestIndex : null;
}

type Verdict = 'ok' | 'too-low' | 'too-high';

/**
 * Detect an obviously wrong join from the shape of the resulting text.
 *
 * `2 4 - W E E K` has an average token length near 1 and almost all single-character tokens,
 * which is the fingerprint of a threshold set below the letter-spacing value. A long line with
 * no spaces at all is the opposite error.
 */
export function sanityCheck(text: string): Verdict {
  const plain = text.split(CELL_BREAK).join(' ');
  const tokens = plain.split(/\s+/).filter((t) => t.length > 0);
  const letters = plain.replace(/\s/g, '');

  if (tokens.length >= 4) {
    const avgLen = letters.length / tokens.length;
    const singles = tokens.filter((t) => t.length === 1).length;
    if (avgLen < 2 || singles / tokens.length > 0.6) return 'too-low';
  }

  if (!plain.includes(' ') && letters.length > 40) return 'too-high';

  return 'ok';
}

function clampRatio(ratio: number): number {
  return Math.min(Math.max(ratio, MIN_SPACE_RATIO), 1.0);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
