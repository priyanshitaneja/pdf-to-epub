import type { TocEntry } from '../../types/document.ts';
import { xmlAttr, xmlText } from '../serialize/xml.ts';

export interface NcxInput {
  uuid: string;
  title: string;
  authors: string[];
  lang: string;
  toc: TocEntry[];
  hrefFor(anchor: string): string;
  coverPageHref: string;
}

/**
 * Build `toc.ncx` — the EPUB2 navigation document.
 *
 * Still emitted because Kindle reads the NCX in preference to nav.xhtml on a good deal of
 * firmware. `playOrder` is a single document-wide monotonic counter, not per-level, and
 * `dtb:depth` must equal the deepest nesting actually present.
 */
export function tocNcx(input: NcxInput): string {
  let playOrder = 0;
  const nextPlayOrder = () => (playOrder += 1);

  const coverPoint = renderPoint(
    { anchor: '__cover__', label: 'Cover', level: 1, children: [] },
    () => input.coverPageHref,
    nextPlayOrder,
    '    ',
  );
  const points = input.toc
    .map((entry) => renderPoint(entry, input.hrefFor, nextPlayOrder, '    '))
    .join('\n');

  const depth = Math.max(1, maxDepth(input.toc));
  const author = input.authors.length > 0 ? input.authors.join(', ') : 'Unknown';

  return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${xmlAttr(input.lang)}">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${xmlAttr(input.uuid)}"/>
    <meta name="dtb:depth" content="${depth}"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${xmlText(input.title)}</text></docTitle>
  <docAuthor><text>${xmlText(author)}</text></docAuthor>
  <navMap>
${coverPoint}
${points}
  </navMap>
</ncx>
`;
}

function renderPoint(
  entry: TocEntry,
  hrefFor: (anchor: string) => string,
  nextPlayOrder: () => number,
  indent: string,
): string {
  const order = nextPlayOrder();
  const children = entry.children
    .map((child) => renderPoint(child, hrefFor, nextPlayOrder, `${indent}  `))
    .join('\n');

  const open = `${indent}<navPoint id="np${order}" playOrder="${order}">`;
  const label = `${indent}  <navLabel><text>${xmlText(entry.label)}</text></navLabel>`;
  const content = `${indent}  <content src="${xmlAttr(hrefFor(entry.anchor))}"/>`;
  const close = `${indent}</navPoint>`;

  return children.length > 0
    ? [open, label, content, children, close].join('\n')
    : [open, label, content, close].join('\n');
}

function maxDepth(entries: TocEntry[], depth = 1): number {
  let deepest = entries.length > 0 ? depth : 0;
  for (const entry of entries) {
    if (entry.children.length > 0) {
      deepest = Math.max(deepest, maxDepth(entry.children, depth + 1));
    }
  }
  return deepest;
}
