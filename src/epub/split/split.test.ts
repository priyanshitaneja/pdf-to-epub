import { describe, expect, it } from 'vitest';
import type { Block, Provenance } from '../../types/document.ts';
import { sampleDoc } from '../__fixtures__/sampleDoc.ts';
import { chooseSplitLevel, MAX_CHAPTER_CHARS, splitIntoChapters } from './chapters.ts';
import { buildToc, countTocEntries } from './toc.ts';

const prov: Provenance = { page: 0, tier: 'A', confidence: 1 };

function heading(id: string, level: 1 | 2 | 3, label: string): Block {
  return { id, kind: 'h', level, anchor: `a-${id}`, inlines: [{ t: 'text', s: label }], prov };
}
function para(id: string, s = 'body text'): Block {
  return { id, kind: 'p', inlines: [{ t: 'text', s }], prov };
}

describe('chooseSplitLevel', () => {
  it('splits on h1 when there are at least three', () => {
    const blocks = [heading('a', 1, 'A'), para('p1'), heading('b', 1, 'B'), para('p2'), heading('c', 1, 'C')];
    expect(chooseSplitLevel(blocks)).toBe(1);
  });

  it('falls back to h2 when h1s are too few', () => {
    const blocks = [
      heading('a', 1, 'A'),
      heading('b', 2, 'B'), para('p1'),
      heading('c', 2, 'C'), para('p2'),
      heading('d', 2, 'D'), para('p3'),
    ];
    expect(chooseSplitLevel(blocks)).toBe(2);
  });

  it('does not split a document with only one or two headings', () => {
    expect(chooseSplitLevel([heading('a', 1, 'A'), para('p1'), heading('b', 1, 'B')])).toBeNull();
  });
});

describe('splitIntoChapters', () => {
  it('keeps an unsplittable document as a single chapter', () => {
    const { chapters } = splitIntoChapters([para('p1'), para('p2')], 'Doc');
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.title).toBe('Doc');
  });

  it('puts front matter before the first heading into its own chapter', () => {
    const blocks = [
      para('intro'),
      heading('a', 1, 'A'), para('p1'), para('p1b'), para('p1c'),
      heading('b', 1, 'B'), para('p2'), para('p2b'), para('p2c'),
      heading('c', 1, 'C'), para('p3'), para('p3b'), para('p3c'),
    ];
    const { chapters } = splitIntoChapters(blocks, 'Doc');
    expect(chapters).toHaveLength(4);
    expect(chapters[0]!.blocks.map((b) => b.id)).toEqual(['intro']);
    expect(chapters[1]!.title).toBe('A');
  });

  it('folds a near-empty chapter into the previous one, keeping its heading', () => {
    const blocks = [
      heading('a', 1, 'A'), para('p1'), para('p1b'), para('p1c'),
      heading('b', 1, 'Stub'),
      heading('c', 1, 'C'), para('p3'), para('p3b'), para('p3c'),
      heading('d', 1, 'D'), para('p4'), para('p4b'), para('p4c'),
    ];
    const { chapters, anchorToHref } = splitIntoChapters(blocks, 'Doc');
    expect(chapters.map((c) => c.title)).toEqual(['A', 'C', 'D']);
    // The stub heading still resolves, so its TOC entry is not dangling.
    expect(anchorToHref.get('a-b')).toBe(chapters[0]!.href);
  });

  it('never splits inside an atomic block', () => {
    const bigCell = 'x'.repeat(MAX_CHAPTER_CHARS);
    const blocks: Block[] = [
      heading('a', 1, 'A'),
      { id: 'big', kind: 'pre', text: bigCell, prov },
      para('after'),
      heading('b', 1, 'B'), para('p2'), para('p2b'), para('p2c'),
      heading('c', 1, 'C'), para('p3'), para('p3b'), para('p3c'),
    ];
    const { chapters } = splitIntoChapters(blocks, 'Doc');
    const preChapters = chapters.filter((c) => c.blocks.some((b) => b.id === 'big'));
    expect(preChapters).toHaveLength(1);
    expect(preChapters[0]!.blocks.filter((b) => b.id === 'big')).toHaveLength(1);
  });

  it('marks size-guard continuations and keeps every block', () => {
    const blocks: Block[] = [heading('a', 1, 'A')];
    for (let i = 0; i < 60; i += 1) blocks.push(para(`p${i}`, 'y'.repeat(5_000)));
    blocks.push(heading('b', 1, 'B'), para('q1'), para('q2'), para('q3'));
    blocks.push(heading('c', 1, 'C'), para('r1'), para('r2'), para('r3'));

    const { chapters } = splitIntoChapters(blocks, 'Doc');
    expect(chapters.some((c) => c.continuation)).toBe(true);
    expect(chapters.some((c) => c.title.endsWith('(cont.)'))).toBe(true);

    const emitted = chapters.flatMap((c) => c.blocks.map((b) => b.id));
    expect(emitted).toHaveLength(blocks.length);
    expect(new Set(emitted).size).toBe(blocks.length);
  });

  it('maps every block id to the chapter that holds it, including nested ones', () => {
    const { blockToHref, chapters } = splitIntoChapters(sampleDoc().blocks, 'Doc');
    // b9 is the target of the fixture's internal link and lives in a later chapter.
    expect(blockToHref.get('b9')).toBeDefined();
    expect(chapters.some((c) => c.href === blockToHref.get('b9'))).toBe(true);
    // A block nested inside a table cell must also be indexed.
    expect(blockToHref.get('t10')).toBeDefined();
  });

  it('gives every chapter a unique id and href', () => {
    const { chapters } = splitIntoChapters(sampleDoc().blocks, 'Doc');
    expect(new Set(chapters.map((c) => c.id)).size).toBe(chapters.length);
    expect(new Set(chapters.map((c) => c.href)).size).toBe(chapters.length);
  });
});

describe('buildToc', () => {
  it('nests deeper headings under shallower ones', () => {
    const toc = buildToc([
      heading('a', 1, 'A'),
      heading('b', 2, 'A.1'),
      heading('c', 2, 'A.2'),
      heading('d', 1, 'B'),
    ]);
    expect(toc).toHaveLength(2);
    expect(toc[0]!.children.map((c) => c.label)).toEqual(['A.1', 'A.2']);
    expect(countTocEntries(toc)).toBe(4);
  });

  it('normalises a document that has no h1 at all', () => {
    const toc = buildToc([heading('a', 2, 'A'), heading('b', 3, 'A.1'), heading('c', 2, 'B')]);
    expect(toc.map((t) => t.label)).toEqual(['A', 'B']);
    expect(toc[0]!.level).toBe(1);
    expect(toc[0]!.children[0]!.level).toBe(2);
  });

  it('does not skip a level when the source jumps h1 to h3', () => {
    const toc = buildToc([heading('a', 1, 'A'), heading('b', 3, 'deep')]);
    expect(toc[0]!.children[0]!.level).toBe(2);
  });

  it('drops headings with no text rather than emitting empty nav entries', () => {
    const toc = buildToc([heading('a', 1, ''), heading('b', 1, 'B')]);
    expect(toc.map((t) => t.label)).toEqual(['B']);
  });
});
