/**
 * A hand-written `DocModel` used to build and test the entire EPUB writer without any PDF
 * parsing. It deliberately contains every construct that has historically broken EPUB
 * generators:
 *
 * - `₹` and `→` — non-ASCII that must survive as literal UTF-8, not named entities
 * - `&` and `<` in text — must be escaped, and must still parse under a strict XML parser
 * - a nested list, a 4-column table with a header row and a colspan
 * - an image asset, and an internal link that has to resolve across a chapter split
 * - enough headings to exercise the splitter and produce a multi-level TOC
 */

import type {
  Asset,
  Block,
  DocMeta,
  DocModel,
  Inline,
  Provenance,
  TocEntry,
} from '../../types/document.ts';

/** A 4x4 solid blue PNG. Small enough to inline, real enough to decode. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVQIW2NkYGD4z0AEYBxVSF' +
  'BQUFBQUAAAJhwCAV8Ck0IAAAAASUVORK5CYII=';

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const prov = (page: number): Provenance => ({ page, tier: 'A', confidence: 1 });

const text = (s: string): Inline => ({ t: 'text', s });
const bold = (s: string): Inline => ({ t: 'text', s, b: true });

export const SAMPLE_META: DocMeta = {
  title: 'A Test Document — ₹1Cr & “Beyond”',
  authors: ['Priyanshi Taneja'],
  language: 'en',
  identifier: 'urn:uuid:11111111-2222-4333-8444-555555555555',
  sourceFileName: 'sample.pdf',
  sourcePageCount: 3,
  titleSource: 'info',
};

export function sampleAssets(): Asset[] {
  return [
    {
      id: 'img-0001',
      blob: new Blob([base64ToBytes(TINY_PNG_BASE64) as unknown as BlobPart], { type: 'image/png' }),
      mime: 'image/png',
      w: 4,
      h: 4,
      hash: '0000000000000000',
      lossless: true,
      isFullPageCandidate: false,
      page: 1,
    },
  ];
}

export function sampleBlocks(): Block[] {
  return [
    {
      id: 'b1',
      kind: 'h',
      level: 1,
      anchor: 'ch-intro',
      inlines: [text('Introduction & Scope')],
      prov: prov(0),
    },
    {
      id: 'b2',
      kind: 'p',
      inlines: [
        text('Costs rose to '),
        bold('₹1,20,000'),
        text(' this quarter — a move from 3 < 5 engineers, which points '),
        { t: 'link', href: '#b9', internal: true, targetBlockId: 'b9', children: [text('to the results')] },
        text('.'),
      ],
      prov: prov(0),
    },
    {
      id: 'b3',
      kind: 'list',
      ordered: false,
      items: [
        {
          id: 'li1',
          blocks: [
            { id: 'b3a', kind: 'p', inlines: [text('Reflowable text → resizable on a Kindle')], prov: prov(0) },
          ],
        },
        {
          id: 'li2',
          blocks: [
            { id: 'b3b', kind: 'p', inlines: [text('Cover art that survives')], prov: prov(0) },
            {
              id: 'b3c',
              kind: 'list',
              ordered: true,
              start: 1,
              items: [
                { id: 'li2a', blocks: [{ id: 'b3d', kind: 'p', inlines: [text('Declared for EPUB2')], prov: prov(0) }] },
                { id: 'li2b', blocks: [{ id: 'b3e', kind: 'p', inlines: [text('Declared for EPUB3')], prov: prov(0) }] },
              ],
              prov: prov(0),
            },
          ],
        },
      ],
      prov: prov(0),
    },
    { id: 'b4', kind: 'pagebreak', sourcePage: 1, prov: prov(0) },
    {
      id: 'b5',
      kind: 'h',
      level: 2,
      anchor: 'ch-figures',
      inlines: [text('Figures')],
      prov: prov(1),
    },
    {
      id: 'b6',
      kind: 'figure',
      assetId: 'img-0001',
      alt: '',
      caption: [text('Figure 1 — a swatch')],
      wPt: 72,
      hPt: 72,
      prov: prov(1),
    },
    {
      id: 'b7',
      kind: 'pre',
      text: 'col a    col b    col c\n1        2        3',
      prov: prov(1),
    },
    { id: 'b8', kind: 'rule', prov: prov(1) },
    {
      id: 'b9',
      kind: 'h',
      level: 1,
      anchor: 'ch-results',
      inlines: [text('Results')],
      prov: prov(2),
    },
    {
      id: 'b10',
      kind: 'table',
      source: 'tagged',
      caption: [text('Quarterly summary')],
      head: [
        {
          cells: [
            { header: true, colspan: 1, rowspan: 1, blocks: [{ id: 't1', kind: 'p', inlines: [text('Quarter')], prov: prov(2) }] },
            { header: true, colspan: 1, rowspan: 1, align: 'right', blocks: [{ id: 't2', kind: 'p', inlines: [text('Spend (₹)')], prov: prov(2) }] },
            { header: true, colspan: 1, rowspan: 1, align: 'right', blocks: [{ id: 't3', kind: 'p', inlines: [text('Headcount')], prov: prov(2) }] },
            { header: true, colspan: 1, rowspan: 1, blocks: [{ id: 't4', kind: 'p', inlines: [text('Notes & risks')], prov: prov(2) }] },
          ],
        },
      ],
      body: [
        {
          cells: [
            { header: false, colspan: 1, rowspan: 1, blocks: [{ id: 't5', kind: 'p', inlines: [text('Q1')], prov: prov(2) }] },
            { header: false, colspan: 1, rowspan: 1, align: 'right', blocks: [{ id: 't6', kind: 'p', inlines: [text('80,000')], prov: prov(2) }] },
            { header: false, colspan: 1, rowspan: 1, align: 'right', blocks: [{ id: 't7', kind: 'p', inlines: [text('3')], prov: prov(2) }] },
            { header: false, colspan: 1, rowspan: 1, blocks: [{ id: 't8', kind: 'p', inlines: [text('baseline')], prov: prov(2) }] },
          ],
        },
        {
          cells: [
            { header: false, colspan: 1, rowspan: 1, blocks: [{ id: 't9', kind: 'p', inlines: [text('Q2')], prov: prov(2) }] },
            { header: false, colspan: 3, rowspan: 1, blocks: [{ id: 't10', kind: 'p', inlines: [text('Merged across three columns — tests colspan')], prov: prov(2) }] },
          ],
        },
      ],
      prov: prov(2),
    },
    {
      id: 'b11',
      kind: 'quote',
      blocks: [{ id: 'b11a', kind: 'p', inlines: [text('Users forgive imperfect conversion; they don’t forgive silent imperfect conversion.')], prov: prov(2) }],
      prov: prov(2),
    },
    {
      id: 'b12',
      kind: 'code',
      text: 'const ok = a < b && c > d;',
      lang: 'ts',
      prov: prov(2),
    },
  ];
}

export function sampleToc(): TocEntry[] {
  return [
    {
      anchor: 'ch-intro',
      label: 'Introduction & Scope',
      level: 1,
      children: [{ anchor: 'ch-figures', label: 'Figures', level: 2, children: [] }],
    },
    { anchor: 'ch-results', label: 'Results', level: 1, children: [] },
  ];
}

export function sampleDoc(): DocModel {
  return {
    meta: SAMPLE_META,
    blocks: sampleBlocks(),
    assets: sampleAssets(),
    toc: sampleToc(),
    report: {
      tierByPage: ['A', 'A', 'A'],
      warnings: [],
      stats: {
        paragraphs: 4,
        headings: 3,
        tables: 1,
        tablesFellBackToPre: 1,
        figures: 1,
        ocrPages: 0,
        unassignedTextRatio: 0,
      },
      durationMs: 0,
    },
  };
}
