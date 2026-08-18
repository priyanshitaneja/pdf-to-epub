import type { PositionedRun } from '../extract/types.ts';
import { toCanonical, type Matrix } from './geometry.ts';

/**
 * The parts of pdf.js's `TextItem` this module needs.
 *
 * Declared locally rather than imported so the adapter can be unit-tested with plain objects,
 * and so a pdf.js type change surfaces here as one compile error instead of many.
 */
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
  dir?: string;
}

export interface PdfTextMarkedContent {
  type: 'beginMarkedContent' | 'beginMarkedContentProps' | 'endMarkedContent';
  id?: string | null;
  tag?: string | null;
}

export type PdfTextContentItem = PdfTextItem | PdfTextMarkedContent;

export interface PdfFontStyle {
  fontFamily?: string;
  /** pdf.js exposes these on the styles map for some fonts. */
  ascent?: number;
  descent?: number;
  vertical?: boolean;
}

export function isTextItem(item: PdfTextContentItem): item is PdfTextItem {
  return typeof (item as PdfTextItem).str === 'string';
}

/**
 * Convert one page's text content into canonical-space runs.
 *
 * Marked-content markers are tracked so each run carries the id of its nearest enclosing
 * marked-content section. That id is the join key Tier A uses against the structure tree, and
 * runs inside an `Artifact` section are dropped here — which is how headers, footers and page
 * numbers disappear for free on tagged documents.
 */
export function textContentToRuns(
  items: PdfTextContentItem[],
  styles: Record<string, PdfFontStyle | undefined>,
  viewportTransform: Matrix,
): { runs: PositionedRun[]; artifacts: PositionedRun[] } {
  const runs: PositionedRun[] = [];
  const artifacts: PositionedRun[] = [];
  const stack: Array<{ id?: string; tag?: string }> = [];

  for (const item of items) {
    if (!isTextItem(item)) {
      if (item.type === 'endMarkedContent') stack.pop();
      else stack.push({ id: item.id ?? undefined, tag: item.tag ?? undefined });
      continue;
    }

    if (item.str.length === 0) continue;

    const run = toRun(item, styles, viewportTransform);
    if (run === null) continue;

    if (stack.some((frame) => frame.tag === 'Artifact')) {
      artifacts.push(run);
      continue;
    }

    const mcid = nearestId(stack);
    if (mcid !== undefined) run.mcid = mcid;
    runs.push(run);
  }

  return { runs, artifacts };
}

function nearestId(stack: Array<{ id?: string }>): string | undefined {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const id = stack[i]!.id;
    if (id !== undefined) return id;
  }
  return undefined;
}

function toRun(
  item: PdfTextItem,
  styles: Record<string, PdfFontStyle | undefined>,
  viewportTransform: Matrix,
): PositionedRun | null {
  if (item.transform.length < 6) return null;
  const transform = item.transform.slice(0, 6) as Matrix;

  const { rect, baselineY, em, skewed } = toCanonical(
    viewportTransform,
    transform,
    item.width,
    item.height,
  );

  const family = styles[item.fontName]?.fontFamily ?? item.fontName;

  return {
    str: item.str,
    rect,
    baselineY,
    em,
    advance: rect.w,
    // Key on the resolved family plus the pdf.js id: the id alone is per-page, and the family
    // alone merges visually distinct subset fonts.
    fontKey: `${family}|${item.fontName}`,
    bold: looksBold(family, item.fontName),
    italic: looksItalic(family, item.fontName),
    mono: looksMono(family),
    skewed,
  };
}

/**
 * Infer weight and style from font naming.
 *
 * Necessarily approximate. pdf.js reports an internal id such as `g_d0_f1`, and subset-embedded
 * fonts frequently have names that carry no style information at all, so this misses sometimes.
 * A width-per-character comparison against the family median would do better and is a candidate
 * for later; for now the naming heuristic covers the common cases.
 */
function looksBold(family: string, fontName: string): boolean {
  return /bold|black|heavy|semib|demib|[-_]700|[-_]800|[-_]900/i.test(`${family} ${fontName}`);
}

function looksItalic(family: string, fontName: string): boolean {
  return /italic|oblique/i.test(`${family} ${fontName}`);
}

function looksMono(family: string): boolean {
  return /mono|courier|consolas|menlo|typewriter/i.test(family);
}
