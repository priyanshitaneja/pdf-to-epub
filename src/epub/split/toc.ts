import type { Block, HeadingBlock, TocEntry } from '../../types/document.ts';

/** Deeper than this and the NCX becomes noise on a small screen. */
export const MAX_TOC_DEPTH = 3;

function headingText(block: HeadingBlock): string {
  return block.inlines.map((i) => (i.t === 'text' ? i.s : '')).join('').trim();
}

/**
 * Build a nested TOC from the heading blocks in document order.
 *
 * Levels are normalised so the tree never skips a level — a document that jumps h1 → h3 is
 * common in PDFs, and emitting that literally produces an invalid nav document. The
 * shallowest heading level present becomes depth 1 regardless of its nominal level, so a
 * document made entirely of h2s still gets a flat, sensible TOC.
 */
export function buildToc(blocks: Block[]): TocEntry[] {
  const headings = collectHeadings(blocks);
  if (headings.length === 0) return [];

  const minLevel = Math.min(...headings.map((h) => h.level));

  const roots: TocEntry[] = [];
  /** Stack of open entries, index 0 = depth 1. */
  const stack: TocEntry[] = [];

  for (const heading of headings) {
    const label = headingText(heading);
    if (label.length === 0) continue;

    // Normalise to a contiguous depth, then clamp: a heading deeper than MAX_TOC_DEPTH is
    // attached at the maximum depth rather than dropped, so nothing disappears from the TOC.
    const rawDepth = heading.level - minLevel + 1;
    const depth = Math.min(rawDepth, MAX_TOC_DEPTH, stack.length + 1);

    const entry: TocEntry = { anchor: heading.anchor, label, level: depth, children: [] };

    if (depth === 1) {
      roots.push(entry);
      stack.length = 0;
      stack.push(entry);
    } else {
      const parent = stack[depth - 2];
      if (parent) {
        parent.children.push(entry);
        stack.length = depth - 1;
        stack.push(entry);
      } else {
        roots.push(entry);
        stack.length = 0;
        stack.push(entry);
      }
    }
  }

  return roots;
}

function collectHeadings(blocks: Block[]): HeadingBlock[] {
  const out: HeadingBlock[] = [];
  for (const block of blocks) {
    if (block.kind === 'h') out.push(block);
    // Headings nested inside quotes or list items are not chapter structure; ignore them.
  }
  return out;
}

/** Count entries across the whole tree. Used by tests and the conversion report. */
export function countTocEntries(entries: TocEntry[]): number {
  return entries.reduce((n, e) => n + 1 + countTocEntries(e.children), 0);
}
