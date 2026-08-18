import type { Rect } from '../../types/document.ts';
import { unionRect } from '../../pdf/geometry.ts';
import { CELL_BREAK, type Line, type PositionedRun } from '../types.ts';
import { createThresholdCache, joinRuns, type ThresholdCache } from './glyphJoin.ts';
import { detrackRun } from './detrack.ts';

/**
 * Runs within this fraction of an em of each other, measured on the baseline, are one line.
 *
 * Clustering on baselines rather than box centres is deliberate: a superscript sits at the
 * same baseline-ish position but has a much higher centre, so centre-based clustering splits
 * `x²` across two lines.
 */
const BASELINE_TOLERANCE_EM = 0.4;

/** A run smaller than this fraction of the line's em is a super/subscript, not body text. */
const SCRIPT_MAX_EM_RATIO = 0.75;
const SCRIPT_MIN_OFFSET_EM = 0.2;
const SCRIPT_MAX_OFFSET_EM = 0.6;

export interface AssembleLinesResult {
  lines: Line[];
  /** Runs excluded because their text matrix is rotated relative to the page. */
  skewed: PositionedRun[];
  /** True when any line's spacing could not be resolved confidently. */
  uncertainSpacing: boolean;
  /** Lines whose letter-spacing pdf.js had already baked in, and which were repaired. */
  detrackedLines: number;
}

/**
 * Group positioned runs into visual lines, then join each line's runs into text.
 */
export function assembleLines(
  runs: PositionedRun[],
  cache: ThresholdCache = createThresholdCache(),
): AssembleLinesResult {
  const upright: PositionedRun[] = [];
  const skewed: PositionedRun[] = [];
  for (const run of runs) {
    if (run.str.length === 0) continue;
    (run.skewed ? skewed : upright).push(run);
  }

  // Sort top-to-bottom, then left-to-right. In canonical space y increases downward, so this
  // reads naturally as reading order for a single column.
  const sorted = [...upright].sort((a, b) => a.baselineY - b.baselineY || a.rect.x - b.rect.x);

  const buckets: PositionedRun[][] = [];
  for (const run of sorted) {
    const bucket = buckets[buckets.length - 1];
    if (bucket && sameLine(bucket, run)) {
      bucket.push(run);
      continue;
    }
    buckets.push([run]);
  }

  let uncertainSpacing = false;
  let detrackedLines = 0;
  const lines: Line[] = [];

  for (const bucket of buckets) {
    const ordered = [...bucket].sort((a, b) => a.rect.x - b.rect.x);
    const em = modalEm(ordered);

    // Repair tracking that pdf.js already baked into each run's string, BEFORE joining. Doing
    // it per-run means the explicit space runs pdf.js emits at real word boundaries still
    // supply those spaces; repairing the joined line instead loses them.
    let detracked = false;
    const cleaned = ordered.map((run) => {
      const repaired = detrackRun(run.str);
      if (!repaired.changed) return run;
      detracked = true;
      return { ...run, str: repaired.text };
    });
    if (detracked) detrackedLines += 1;

    const marked = markScripts(cleaned, em);
    const joined = joinRuns(marked, { cache });
    // A de-tracked line is no longer "uncertain" in the sense joinRuns meant - its string was
    // already spaced by pdf.js, so the gap heuristic never had a say.
    if (joined.uncertain && !detracked) uncertainSpacing = true;

    lines.push({
      runs: marked,
      rect: unionRect(marked.map((r) => r.rect)),
      baselineY: median(marked.map((r) => r.baselineY)),
      em,
      text: joined.text,
      bold: boldMajority(marked),
      column: 0,
    });
  }

  return { lines, skewed, uncertainSpacing, detrackedLines };
}

function sameLine(bucket: PositionedRun[], run: PositionedRun): boolean {
  const reference = bucket[bucket.length - 1]!;
  const em = Math.max(reference.em, run.em) || 1;
  return Math.abs(run.baselineY - reference.baselineY) < BASELINE_TOLERANCE_EM * em;
}

/**
 * Tag super- and subscripts.
 *
 * Detected by being both smaller than the line's body size and offset from its baseline. The
 * offset direction decides which: up is a superscript, down a subscript.
 */
function markScripts(runs: PositionedRun[], lineEm: number): PositionedRun[] {
  const baseline = median(runs.map((r) => r.baselineY));
  return runs.map((run) => {
    if (run.em >= SCRIPT_MAX_EM_RATIO * lineEm) return run;
    const offset = (baseline - run.baselineY) / (lineEm || 1);
    const magnitude = Math.abs(offset);
    if (magnitude < SCRIPT_MIN_OFFSET_EM || magnitude > SCRIPT_MAX_OFFSET_EM) return run;
    return { ...run, script: offset > 0 ? ('sup' as const) : ('sub' as const) };
  });
}

/**
 * Most common em on the line, weighted by how much text is set at that size.
 *
 * Weighting by character count stops a single small footnote marker from deciding the line's
 * body size.
 */
export function modalEm(runs: PositionedRun[]): number {
  const weights = new Map<number, number>();
  for (const run of runs) {
    const key = Math.round(run.em * 10) / 10;
    weights.set(key, (weights.get(key) ?? 0) + run.str.length);
  }
  let best = runs[0]?.em ?? 0;
  let bestWeight = -1;
  for (const [em, weight] of weights) {
    if (weight > bestWeight) {
      bestWeight = weight;
      best = em;
    }
  }
  return best;
}

function boldMajority(runs: PositionedRun[]): boolean {
  let bold = 0;
  let total = 0;
  for (const run of runs) {
    const weight = run.str.replace(new RegExp(CELL_BREAK, 'g'), '').length;
    total += weight;
    if (run.bold) bold += weight;
  }
  return total > 0 && bold / total > 0.6;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Median vertical distance between consecutive baselines. Drives paragraph breaks. */
export function medianLeading(lines: Line[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const gap = lines[i]!.baselineY - lines[i - 1]!.baselineY;
    if (gap > 0) gaps.push(gap);
  }
  return median(gaps);
}

export function lineBounds(lines: Line[]): Rect {
  return unionRect(lines.map((l) => l.rect));
}
