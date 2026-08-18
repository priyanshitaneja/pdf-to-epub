import type { Line } from '../types.ts';
import { stripCellBreaks } from '../types.ts';

/** A line must be at least this much larger than body text to be a heading candidate. */
const HEADING_EM_RATIO = 1.12;
/** Headings are short; anything longer than this is a paragraph whatever its size. */
const HEADING_MAX_CHARS = 120;
/** Em values within this fraction of each other are treated as the same heading level. */
const LEVEL_CLUSTER_TOLERANCE = 0.05;

const NUMBERED = /^(\d+(?:\.\d+)*)\s+\S/;
const SENTENCE_END = /[.!?:;,]$/;

/**
 * A line tagged with the heading level it should become, or 0 for body text.
 *
 * Returned as a parallel annotation rather than folded into `Line` so paragraph assembly can
 * treat a heading as its own group without heading logic leaking into it.
 */
export interface AnnotatedLine extends Line {
  headingLevel: 0 | 1 | 2 | 3 | 4;
}

/**
 * Identify headings among a page's lines.
 *
 * Size relative to the document's body text is the primary signal, but numbering overrides it:
 * in a technical document `1.2.3` is a more reliable depth cue than font size, which often
 * varies for reasons unrelated to hierarchy.
 */
export function detectHeadings(
  lines: Line[],
  bodyEm?: number,
  /**
   * Whether this document numbers its headings. Decided document-wide by the caller, because a
   * single page rarely carries enough numbered headings to judge and an inconsistent answer
   * assigns different levels to the same visual heading on different pages.
   */
  useNumberingOverride?: boolean,
): AnnotatedLine[] {
  const body = bodyEm ?? modalBodyEm(lines);

  const candidates = lines.filter((line) => isCandidate(line, body));
  const numbered = candidates.filter((line) => NUMBERED.test(stripCellBreaks(line.text)));

  // Numbering wins when enough headings carry it - dot depth is unambiguous where size is not.
  const useNumbering = useNumberingOverride ?? numbered.length >= 3;

  const levelForEm = buildEmLevelMap(candidates.map((l) => l.em));

  return lines.map((line) => {
    if (!isCandidate(line, body)) return { ...line, headingLevel: 0 as const };

    const text = stripCellBreaks(line.text);

    if (useNumbering) {
      const match = NUMBERED.exec(text);
      if (match) {
        const depth = match[1]!.split('.').length;
        return { ...line, headingLevel: clampLevel(depth) };
      }
    }

    return { ...line, headingLevel: clampLevel(levelForEm.get(round(line.em)) ?? 1) };
  });
}

function isCandidate(line: Line, bodyEm: number): boolean {
  const text = stripCellBreaks(line.text);
  if (text.length === 0 || text.length > HEADING_MAX_CHARS) return false;

  // A trailing full stop or comma marks prose, however large it is set.
  if (SENTENCE_END.test(text)) return false;

  const larger = bodyEm > 0 && line.em >= bodyEm * HEADING_EM_RATIO;

  // A run-in heading is set at body size but bold and short, which is how most technical
  // documents mark sub-sections.
  const runIn = line.bold && text.length <= 80 && bodyEm > 0 && line.em >= bodyEm * 0.95;

  // All-caps short lines at or above body size are almost always headings or kickers.
  const allCaps =
    text.length <= 60 &&
    /^[^\p{Ll}]+$/u.test(text) &&
    /\p{Lu}/u.test(text) &&
    bodyEm > 0 &&
    line.em >= bodyEm * 0.9;

  return larger || runIn || allCaps;
}

/**
 * The document's body text size: the most common em, weighted by how much text is set at it.
 *
 * Weighting by character count is what stops a three-word 40pt title from being mistaken for
 * body text in a document whose body is 10pt.
 */
export function modalBodyEm(lines: Line[]): number {
  const weights = new Map<number, number>();
  for (const line of lines) {
    const key = round(line.em);
    weights.set(key, (weights.get(key) ?? 0) + stripCellBreaks(line.text).length);
  }

  let best = 0;
  let bestWeight = -1;
  for (const [em, weight] of weights) {
    if (weight > bestWeight) {
      bestWeight = weight;
      best = em;
    }
  }
  return best;
}

/**
 * Rank distinct candidate sizes largest-first and assign levels.
 *
 * Sizes within `LEVEL_CLUSTER_TOLERANCE` of each other collapse to one level, because PDF
 * producers emit tiny size variations that do not indicate hierarchy.
 */
function buildEmLevelMap(ems: number[]): Map<number, number> {
  const distinct = [...new Set(ems.map(round))].sort((a, b) => b - a);

  const map = new Map<number, number>();
  let level = 1;
  let clusterHead: number | null = null;

  for (const em of distinct) {
    if (clusterHead !== null && (clusterHead - em) / clusterHead > LEVEL_CLUSTER_TOLERANCE) {
      level += 1;
    }
    if (clusterHead === null || (clusterHead - em) / clusterHead > LEVEL_CLUSTER_TOLERANCE) {
      clusterHead = em;
    }
    map.set(em, level);
  }

  return map;
}

function clampLevel(depth: number): 1 | 2 | 3 | 4 {
  return Math.min(Math.max(depth, 1), 4) as 1 | 2 | 3 | 4;
}

function round(em: number): number {
  return Math.round(em * 10) / 10;
}
