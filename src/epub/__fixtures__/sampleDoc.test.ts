import { describe, expect, it } from 'vitest';
import { sampleDoc } from './sampleDoc.ts';
import type { Block } from '../../types/document.ts';

function walk(blocks: Block[], visit: (b: Block) => void): void {
  for (const b of blocks) {
    visit(b);
    if (b.kind === 'quote') walk(b.blocks, visit);
    if (b.kind === 'list') for (const item of b.items) walk(item.blocks, visit);
    if (b.kind === 'table') {
      for (const row of [...b.head, ...b.body]) {
        for (const cell of row.cells) walk(cell.blocks, visit);
      }
    }
  }
}

describe('sampleDoc fixture', () => {
  it('has a unique id on every block, including nested ones', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    walk(sampleDoc().blocks, (b) => {
      if (seen.has(b.id)) duplicates.push(b.id);
      seen.add(b.id);
    });
    expect(duplicates).toEqual([]);
  });

  it('exercises the characters that break naive XML serializers', () => {
    const doc = sampleDoc();
    const allText: string[] = [doc.meta.title];
    walk(doc.blocks, (b) => {
      if (b.kind === 'p' || b.kind === 'h') {
        for (const inline of b.inlines) if (inline.t === 'text') allText.push(inline.s);
      }
      if (b.kind === 'code' || b.kind === 'pre') allText.push(b.text);
    });
    const joined = allText.join(' ');
    for (const ch of ['₹', '→', '&', '<']) {
      expect(joined, `fixture should contain ${ch}`).toContain(ch);
    }
  });

  it('points every internal link at a block that exists', () => {
    const doc = sampleDoc();
    const ids = new Set<string>();
    walk(doc.blocks, (b) => ids.add(b.id));

    const targets: string[] = [];
    walk(doc.blocks, (b) => {
      if (b.kind !== 'p' && b.kind !== 'h') return;
      for (const inline of b.inlines) {
        if (inline.t === 'link' && inline.internal && inline.targetBlockId) {
          targets.push(inline.targetBlockId);
        }
      }
    });

    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) expect(ids).toContain(target);
  });

  it('references only assets that exist', () => {
    const doc = sampleDoc();
    const assetIds = new Set(doc.assets.map((a) => a.id));
    walk(doc.blocks, (b) => {
      if (b.kind === 'figure') expect(assetIds).toContain(b.assetId);
    });
    expect(assetIds.size).toBeGreaterThan(0);
  });
});
