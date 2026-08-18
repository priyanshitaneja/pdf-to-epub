import type { Block, Inline, Provenance } from '../../types/document.ts';
import { unionRect } from '../../pdf/geometry.ts';
import { CELL_BREAK, stripCellBreaks, type Line } from '../types.ts';
import { median, medianLeading } from './lines.ts';

/** A leading gap this much larger than the document's median starts a new paragraph. */
const LEADING_BREAK_FACTOR = 1.35;
/** A first-line indent of at least this many ems starts a new paragraph in indent-style docs. */
const INDENT_BREAK_EM = 0.5;
/** A line ending this far short of the column edge is a paragraph's last line. */
const SHORT_LINE_EM = 2.5;

const LIST_MARKER = /^(\d+[.)]|[a-z][.)]|\([a-z0-9]+\)|[•·▪◦‣–—*])\s+/i;
const ORDERED_MARKER = /^(\d+)[.)]\s+/;

/** Prefixes that are legitimately hyphenated, so the hyphen must survive a line break. */
const HYPHEN_PREFIXES = new Set([
  'non', 'self', 'co', 'pre', 're', 'anti', 'multi', 'inter', 'sub', 'semi', 'e', 'x', 'ex',
  'post', 'pro', 'quasi', 'pseudo',
]);

export interface ParagraphOptions {
  page: number;
  /** Carried in from the previous page so a paragraph can span a page boundary. */
  pending?: PendingParagraph | null;
  idPrefix?: string;
}

/**
 * A paragraph held back because it might continue on the next page.
 *
 * De-hyphenation across a page boundary needs the next page's first line, so the last
 * paragraph of every page is buffered rather than emitted immediately.
 */
export interface PendingParagraph {
  lines: Line[];
  page: number;
}

export interface ParagraphResult {
  blocks: Block[];
  pending: PendingParagraph | null;
}

/**
 * Group lines into paragraphs and list items.
 *
 * Deliberately not a single rule: PDFs signal paragraph boundaries inconsistently, so the
 * document is first classified as indent-style or block-style, and only then are the
 * per-boundary signals applied.
 */
export function assembleParagraphs(
  lines: Line[],
  options: ParagraphOptions,
): ParagraphResult {
  const incoming = options.pending?.lines ?? [];
  const all = [...incoming, ...lines];
  if (all.length === 0) return { blocks: [], pending: options.pending ?? null };

  const leading = medianLeading(all);
  const columnLeft = Math.min(...all.map((l) => l.rect.x));
  const columnRight = Math.max(...all.map((l) => l.rect.x + l.rect.w));
  const indentStyle = detectIndentStyle(all, columnLeft, leading);

  const groups: Line[][] = [[all[0]!]];
  for (let i = 1; i < all.length; i += 1) {
    const previous = all[i - 1]!;
    const current = all[i]!;
    if (
      breaksParagraph({ previous, current, leading, columnLeft, columnRight, indentStyle })
    ) {
      groups.push([current]);
    } else {
      groups[groups.length - 1]!.push(current);
    }
  }

  // The final group is held back only if more pages may follow.
  const holdLast = groups.length > 0;
  const emitted = holdLast ? groups.slice(0, -1) : groups;
  const pending = holdLast
    ? { lines: groups[groups.length - 1]!, page: options.page }
    : null;

  const prefix = options.idPrefix ?? `p${options.page}`;
  const blocks: Block[] = [];
  emitted.forEach((group, index) => {
    const block = toBlock(group, `${prefix}-${index}`, options.page);
    if (block) blocks.push(block);
  });

  return { blocks, pending };
}

/** Emit whatever is still buffered. Called once after the last page. */
export function flushPending(pending: PendingParagraph | null): Block[] {
  if (!pending || pending.lines.length === 0) return [];
  const block = toBlock(pending.lines, `p${pending.page}-final`, pending.page);
  return block ? [block] : [];
}

/**
 * Decide whether the document indents first lines or separates paragraphs with extra leading.
 *
 * Getting this wrong in either direction is costly: treating a block-style document as
 * indent-style splits on every accidental indent, and the reverse merges every paragraph.
 */
function detectIndentStyle(lines: Line[], columnLeft: number, leading: number): boolean {
  let indented = 0;
  let candidates = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const previous = lines[i - 1]!;
    const current = lines[i]!;
    const gap = current.baselineY - previous.baselineY;
    // Only consider lines that follow at normal leading; a large gap is its own signal.
    if (leading > 0 && gap > leading * LEADING_BREAK_FACTOR) continue;
    candidates += 1;
    if (current.rect.x - columnLeft > INDENT_BREAK_EM * (current.em || 1)) indented += 1;
  }

  return candidates > 0 && indented / candidates > 0.5;
}

function breaksParagraph(input: {
  previous: Line;
  current: Line;
  leading: number;
  columnLeft: number;
  columnRight: number;
  indentStyle: boolean;
}): boolean {
  const { previous, current, leading, columnLeft, columnRight, indentStyle } = input;
  const em = current.em || previous.em || 1;
  const previousText = stripCellBreaks(previous.text);

  // Never break mid-word or inside an unclosed construct, whatever else suggests otherwise.
  if (/[-‐­]$/.test(previousText)) return false;
  if (hasUnclosedDelimiter(previousText)) return false;

  const gap = current.baselineY - previous.baselineY;
  if (leading > 0 && gap > leading * LEADING_BREAK_FACTOR) return true;

  if (indentStyle && current.rect.x - columnLeft > INDENT_BREAK_EM * em) return true;

  if (LIST_MARKER.test(stripCellBreaks(current.text))) return true;

  // A short final line that ends a sentence closes the paragraph.
  const endsShort = previous.rect.x + previous.rect.w < columnRight - SHORT_LINE_EM * em;
  if (endsShort && /[.!?"'”’)\]]$/.test(previousText)) return true;

  // A clear size or weight change is a new block, not a continuation.
  if (Math.abs(current.em - previous.em) / em > 0.1) return true;
  if (current.bold !== previous.bold) return true;

  return false;
}

function hasUnclosedDelimiter(text: string): boolean {
  let round = 0;
  let square = 0;
  for (const ch of text) {
    if (ch === '(') round += 1;
    else if (ch === ')') round -= 1;
    else if (ch === '[') square += 1;
    else if (ch === ']') square -= 1;
  }
  return round > 0 || square > 0;
}

function toBlock(lines: Line[], id: string, page: number): Block | null {
  const text = joinLines(lines);
  if (text.trim().length === 0) return null;

  const prov: Provenance = {
    page,
    tier: 'B',
    rect: unionRect(lines.map((l) => l.rect)),
    confidence: confidenceFor(lines),
  };

  const marker = LIST_MARKER.exec(text);
  if (marker) {
    const ordered = ORDERED_MARKER.exec(text);
    const body = text.slice(marker[0].length);
    return {
      id,
      kind: 'list',
      ordered: ordered !== null,
      start: ordered ? Number(ordered[1]) : undefined,
      items: [{ id: `${id}-li`, blocks: [{ id: `${id}-li-p`, kind: 'p', inlines: toInlines(body, lines), prov }] }],
      prov,
    };
  }

  return { id, kind: 'p', inlines: toInlines(text, lines), prov };
}

/**
 * Join lines into one paragraph string, de-hyphenating across the break.
 *
 * A trailing hyphen followed by a lowercase continuation is a split word and the hyphen is
 * dropped. Two guards keep real compounds intact: both halves capitalised, or a left half
 * that is a known prefix.
 */
export function joinLines(lines: Line[]): string {
  let out = '';

  for (const [index, line] of lines.entries()) {
    const text = line.text;
    if (index === 0) {
      out = text;
      continue;
    }

    const hyphen = /([\p{L}]+)[-‐­]$/u.exec(stripCellBreaks(out));
    const nextWord = /^([\p{L}]+)/u.exec(stripCellBreaks(text));

    if (hyphen && nextWord && shouldDehyphenate(hyphen[1]!, nextWord[1]!)) {
      out = out.replace(/[-‐­]$/, '') + text;
      continue;
    }

    out += (out.endsWith(CELL_BREAK) || text.startsWith(CELL_BREAK) ? '' : ' ') + text;
  }

  return out;
}

function shouldDehyphenate(left: string, right: string): boolean {
  if (HYPHEN_PREFIXES.has(left.toLowerCase())) return false;
  // A capitalised second half suggests a proper compound such as "Anglo-Saxon".
  if (/^[\p{Lu}]/u.test(right)) return false;
  return /^[\p{Ll}]/u.test(right);
}

/**
 * Convert paragraph text back into inlines, re-applying the runs' styling.
 *
 * Styling is derived from the runs rather than the joined string, because the string has lost
 * the mapping. Runs that agree on style are merged so the output does not fragment into one
 * span per glyph.
 */
function toInlines(text: string, lines: Line[]): Inline[] {
  const plain = stripCellBreaks(text);
  if (plain.length === 0) return [];

  const styled = lines.some((l) => l.runs.some((r) => r.bold || r.italic || r.mono || r.script));
  if (!styled) return [{ t: 'text', s: plain }];

  // Rebuild from runs, merging adjacent runs with identical styling.
  const inlines: Inline[] = [];
  for (const line of lines) {
    for (const run of line.runs) {
      const s = stripCellBreaks(run.str);
      if (s.length === 0) continue;
      const previous = inlines[inlines.length - 1];
      const style = {
        b: run.bold ? (true as const) : undefined,
        i: run.italic ? (true as const) : undefined,
        code: run.mono ? (true as const) : undefined,
        sup: run.script === 'sup' ? (true as const) : undefined,
        sub: run.script === 'sub' ? (true as const) : undefined,
      };
      if (
        previous?.t === 'text' &&
        previous.b === style.b &&
        previous.i === style.i &&
        previous.code === style.code &&
        previous.sup === style.sup &&
        previous.sub === style.sub
      ) {
        previous.s += previous.s.endsWith(' ') || s.startsWith(' ') ? s : ` ${s}`;
        continue;
      }
      inlines.push({ t: 'text', s, ...dropUndefined(style) });
    }
  }

  return inlines.length > 0 ? inlines : [{ t: 'text', s: plain }];
}

function dropUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) if (value !== undefined) out[key] = value;
  return out as Partial<T>;
}

function confidenceFor(lines: Line[]): number {
  const confidences = lines.flatMap((l) => l.runs.map((r) => r.conf).filter((c): c is number => c !== undefined));
  if (confidences.length === 0) return 0.8;
  return median(confidences) / 100;
}
