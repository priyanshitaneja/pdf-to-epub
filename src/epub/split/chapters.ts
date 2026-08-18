import type { Block, HeadingBlock } from '../../types/document.ts';

/**
 * Serialized-size ceiling for one chapter file.
 *
 * Kindle's converter slows sharply on very large XHTML files, and a single enormous file
 * also makes position restore imprecise. This is a soft guard: it splits at a heading if one
 * is available, and only hard-splits when there is nothing better.
 */
export const MAX_CHAPTER_CHARS = 200_000;

/** Chapters smaller than this are folded into the previous one rather than shipped alone. */
export const MIN_CHAPTER_BLOCKS = 3;

export interface Chapter {
  id: string;
  href: string;
  title: string;
  blocks: Block[];
  /** Heading anchors that live in this chapter, in document order. */
  anchors: string[];
  /** True when this is a `(cont.)` continuation produced by the size guard. */
  continuation: boolean;
}

export type SplitLevel = 1 | 2 | null;

/**
 * Pick the heading level to split on.
 *
 * Requires at least three headings at a level before using it: a document with a single h1
 * would otherwise produce one chapter plus a stub, and one with two h1s gives a lopsided
 * split that reads worse than not splitting at all.
 */
export function chooseSplitLevel(blocks: Block[]): SplitLevel {
  const counts = new Map<number, number>();
  for (const b of blocks) {
    if (b.kind === 'h') counts.set(b.level, (counts.get(b.level) ?? 0) + 1);
  }
  if ((counts.get(1) ?? 0) >= 3) return 1;
  if ((counts.get(2) ?? 0) >= 3) return 2;
  return null;
}

/** Blocks that must never be broken across two chapter files. */
function isAtomic(block: Block): boolean {
  return (
    block.kind === 'table' ||
    block.kind === 'list' ||
    block.kind === 'pre' ||
    block.kind === 'code' ||
    block.kind === 'figure' ||
    block.kind === 'quote'
  );
}

/** Cheap proxy for serialized size. Exact bytes are not needed for a soft guard. */
function blockWeight(block: Block): number {
  switch (block.kind) {
    case 'p':
    case 'h':
      return JSON.stringify(block.inlines).length;
    case 'code':
    case 'pre':
      return block.text.length;
    case 'table':
      return JSON.stringify(block.head).length + JSON.stringify(block.body).length;
    case 'list':
      return JSON.stringify(block.items).length;
    case 'quote':
      return block.blocks.reduce((n, b) => n + blockWeight(b), 0);
    default:
      return 32;
  }
}

function headingText(block: HeadingBlock): string {
  return block.inlines
    .map((inline) => (inline.t === 'text' ? inline.s : inline.t === 'link' ? '' : ''))
    .join('')
    .trim();
}

export interface SplitResult {
  chapters: Chapter[];
  splitLevel: SplitLevel;
  /** Maps a heading anchor to the chapter href that contains it. */
  anchorToHref: Map<string, string>;
  /** Maps a block id to the chapter href that contains it, for internal link resolution. */
  blockToHref: Map<string, string>;
}

export function splitIntoChapters(blocks: Block[], docTitle: string): SplitResult {
  const splitLevel = chooseSplitLevel(blocks);
  const groups = groupBySplitLevel(blocks, splitLevel, docTitle);
  const merged = mergeTinyGroups(groups);
  const sized = applySizeGuard(merged);
  const chapters = numberChapters(sized);

  const anchorToHref = new Map<string, string>();
  const blockToHref = new Map<string, string>();
  for (const chapter of chapters) {
    for (const anchor of chapter.anchors) anchorToHref.set(anchor, chapter.href);
    indexBlockIds(chapter.blocks, chapter.href, blockToHref);
  }

  return { chapters, splitLevel, anchorToHref, blockToHref };
}

function indexBlockIds(blocks: Block[], href: string, out: Map<string, string>): void {
  for (const block of blocks) {
    out.set(block.id, href);
    if (block.kind === 'quote') indexBlockIds(block.blocks, href, out);
    if (block.kind === 'list') for (const item of block.items) indexBlockIds(item.blocks, href, out);
    if (block.kind === 'table') {
      for (const row of [...block.head, ...block.body]) {
        for (const cell of row.cells) indexBlockIds(cell.blocks, href, out);
      }
    }
  }
}

interface Group {
  title: string;
  blocks: Block[];
  continuation: boolean;
}

function groupBySplitLevel(blocks: Block[], level: SplitLevel, docTitle: string): Group[] {
  if (level === null) return [{ title: docTitle, blocks: [...blocks], continuation: false }];

  const groups: Group[] = [];
  let current: Group | null = null;

  for (const block of blocks) {
    if (block.kind === 'h' && block.level === level) {
      current = { title: headingText(block) || docTitle, blocks: [block], continuation: false };
      groups.push(current);
      continue;
    }
    if (current === null) {
      // Front matter before the first heading of the split level.
      current = { title: docTitle, blocks: [], continuation: false };
      groups.push(current);
    }
    current.blocks.push(block);
  }

  return groups.filter((g) => g.blocks.length > 0);
}

/**
 * Fold near-empty groups into the previous chapter.
 *
 * The heading stays in the merged content, so it still gets a TOC entry — just as a
 * fragment within the previous file rather than its own spine item.
 */
function mergeTinyGroups(groups: Group[]): Group[] {
  const out: Group[] = [];
  for (const group of groups) {
    const substantive = group.blocks.filter((b) => b.kind !== 'pagebreak' && b.kind !== 'rule');
    const previous = out[out.length - 1];
    if (previous && substantive.length < MIN_CHAPTER_BLOCKS) {
      previous.blocks.push(...group.blocks);
      continue;
    }
    out.push({ ...group, blocks: [...group.blocks] });
  }
  return out;
}

function applySizeGuard(groups: Group[]): Group[] {
  const out: Group[] = [];

  for (const group of groups) {
    const total = group.blocks.reduce((n, b) => n + blockWeight(b), 0);
    if (total <= MAX_CHAPTER_CHARS) {
      out.push(group);
      continue;
    }

    let part: Block[] = [];
    let weight = 0;
    let first = true;

    for (const block of group.blocks) {
      const w = blockWeight(block);
      const wouldOverflow = weight + w > MAX_CHAPTER_CHARS && part.length > 0;
      // Prefer breaking before a heading; otherwise before any non-atomic block. An atomic
      // block is never split, so a single oversized table simply makes its part large.
      const canBreakHere = block.kind === 'h' || !isAtomic(block);

      if (wouldOverflow && canBreakHere) {
        out.push({ title: group.title, blocks: part, continuation: !first });
        first = false;
        part = [];
        weight = 0;
      }
      part.push(block);
      weight += w;
    }

    if (part.length > 0) {
      out.push({ title: group.title, blocks: part, continuation: !first });
    }
  }

  return out;
}

function numberChapters(groups: Group[]): Chapter[] {
  return groups.map((group, index) => {
    const id = `ch${String(index).padStart(3, '0')}`;
    const anchors = group.blocks
      .filter((b): b is HeadingBlock => b.kind === 'h')
      .map((h) => h.anchor);
    return {
      id,
      href: `${id}.xhtml`,
      title: group.continuation ? `${group.title} (cont.)` : group.title,
      blocks: group.blocks,
      anchors,
      continuation: group.continuation,
    };
  });
}
