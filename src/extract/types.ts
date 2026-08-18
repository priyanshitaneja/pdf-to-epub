import type { Rect } from '../types/document.ts';

/**
 * One positioned piece of text: either a pdf.js `TextItem` or a single OCR word.
 *
 * This is the internal seam that makes the OCR path cheap. Tier C converts Tesseract's word
 * boxes into `PositionedRun`s, which means **OCR only replaces the source of runs** — every
 * Tier B stage after this point (lines, paragraphs, headings, columns, tables) is reused
 * verbatim on scanned documents rather than reimplemented.
 *
 * All geometry is in canonical page space: upright, y-down, origin top-left, units = points.
 */
export interface PositionedRun {
  str: string;
  rect: Rect;
  /** y of the text baseline, not the top of the box. Line clustering depends on this. */
  baselineY: number;
  /** Effective glyph height in points — the rendered em size, after the text matrix. */
  em: number;
  /** Horizontal advance of this run, in points. */
  advance: number;
  /** Stable key identifying the font, used to group runs for spacing calibration. */
  fontKey: string;
  bold: boolean;
  italic: boolean;
  mono: boolean;
  /** Marked-content id, Tier A only. Links the run to a struct-tree leaf. */
  mcid?: string;
  /** OCR confidence 0-100, Tier C only. */
  conf?: number;
  /** True when the run's text matrix is rotated or skewed relative to the page. */
  skewed?: boolean;
  /** Set by line assembly when the run is offset and smaller than the line's body size. */
  script?: 'sup' | 'sub';
}

/** Runs assembled into one visual line. */
export interface Line {
  runs: PositionedRun[];
  rect: Rect;
  baselineY: number;
  /** Modal em across the line's runs. */
  em: number;
  text: string;
  /** True when the majority of the line's width is bold. */
  bold: boolean;
  /** Column band index, assigned by column detection. 0 for single-column pages. */
  column: number;
}

/**
 * Inserted in place of a very large horizontal gap.
 *
 * A gap that wide is not a word space — it is column separation. Emitting a distinct marker
 * rather than a run of spaces is what lets the whitespace table detector find cell boundaries
 * later, without having to re-measure geometry it no longer has.
 *
 * Deliberately a C0 control character (unit separator): `sanitizeXmlText` in the serializer
 * strips those, so a marker that escapes this layer by mistake can never reach the output.
 */
export const CELL_BREAK: string = String.fromCharCode(0x1f);

/** Replace cell-break markers with ordinary spaces, for when plain text is wanted. */
export function stripCellBreaks(s: string): string {
  return s.split(CELL_BREAK).join(' ').replace(/\s+/g, ' ').trim();
}
