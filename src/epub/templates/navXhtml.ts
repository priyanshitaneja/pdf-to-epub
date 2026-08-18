import type { TocEntry } from '../../types/document.ts';
import { xhtmlDoc, xmlAttr, xmlText } from '../serialize/xml.ts';

export interface NavInput {
  lang: string;
  toc: TocEntry[];
  /** Maps a TOC anchor to an href relative to the OEBPS directory. */
  hrefFor(anchor: string): string;
  coverPageHref: string;
  firstChapterHref: string;
  cssHref: string;
}

/**
 * Build `nav.xhtml` — the EPUB3 navigation document.
 *
 * The `landmarks` nav is emitted alongside the `toc` nav because it is what tells a reader
 * where the cover and the start of the body content are. The reference EPUB on disk omits
 * it, which is one of the things this generator improves on.
 */
export function navXhtml(input: NavInput): string {
  const body = `  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
${renderList(input.toc, input.hrefFor, '    ')}
  </nav>
  <nav epub:type="landmarks" id="landmarks" hidden="hidden">
    <h2>Guide</h2>
    <ol>
      <li><a epub:type="cover" href="${xmlAttr(input.coverPageHref)}">Cover</a></li>
      <li><a epub:type="toc" href="nav.xhtml">Table of Contents</a></li>
      <li><a epub:type="bodymatter" href="${xmlAttr(input.firstChapterHref)}">Start of Content</a></li>
    </ol>
  </nav>`;

  return xhtmlDoc({
    title: 'Contents',
    lang: input.lang,
    stylesheetHref: input.cssHref,
    body,
  });
}

function renderList(
  entries: TocEntry[],
  hrefFor: (anchor: string) => string,
  indent: string,
): string {
  if (entries.length === 0) return `${indent}<ol></ol>`;
  const items = entries
    .map((entry) => {
      const link = `<a href="${xmlAttr(hrefFor(entry.anchor))}">${xmlText(entry.label)}</a>`;
      if (entry.children.length === 0) return `${indent}  <li>${link}</li>`;
      return `${indent}  <li>${link}\n${renderList(entry.children, hrefFor, `${indent}  `)}\n${indent}  </li>`;
    })
    .join('\n');
  return `${indent}<ol>\n${items}\n${indent}</ol>`;
}
