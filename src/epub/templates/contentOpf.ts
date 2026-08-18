import type { ImageMime } from '../../types/document.ts';
import { epubTimestamp, xmlAttr, xmlText } from '../serialize/xml.ts';

export interface ManifestChapter {
  id: string;
  href: string;
}

export interface ManifestImage {
  id: string;
  href: string;
  mime: ImageMime;
}

export interface ContentOpfInput {
  uuid: string;
  title: string;
  authors: string[];
  language: string;
  publisher?: string;
  subjects?: string[];
  modified?: Date;
  chapters: ManifestChapter[];
  images: ManifestImage[];
  /** The manifest id of the cover image, and its href/mime. */
  cover: { id: string; href: string; mime: ImageMime };
  /** True when cover.xhtml contains inline SVG, which epubcheck requires be declared. */
  coverUsesSvg: boolean;
  navHref: string;
  ncxHref: string;
  cssHref: string;
  coverPageHref: string;
}

/**
 * Build `content.opf`.
 *
 * This file is the entire reason the tool exists. Kindle locates a cover through the
 * **EPUB2** `<meta name="cover" content="ID"/>` line in `<metadata>`, and that line must
 * carry no namespace prefix. Most free converters emit only the EPUB3
 * `properties="cover-image"` manifest attribute, so Send-to-Kindle finds nothing and the
 * book shows up as a grey placeholder. We emit both, plus a `<guide>` reference, and put
 * cover.xhtml first in the spine.
 */
export function contentOpf(input: ContentOpfInput): string {
  const lang = xmlAttr(input.language);
  const firstChapterHref = input.chapters[0]?.href ?? input.coverPageHref;

  const creators = input.authors.length > 0 ? input.authors : ['Unknown'];
  const creatorLines = creators
    .flatMap((author, i) => [
      `    <dc:creator id="creator-${i}">${xmlText(author)}</dc:creator>`,
      `    <meta refines="#creator-${i}" property="role" scheme="marc:relators">aut</meta>`,
    ])
    .join('\n');

  const subjectLines = (input.subjects ?? [])
    .map((s) => `    <dc:subject>${xmlText(s)}</dc:subject>`)
    .join('\n');

  const ts = epubTimestamp(input.modified ?? new Date());

  // The cover image is listed first in the manifest, matching the known-good reference EPUB.
  const manifestLines = [
    `    <item id="${xmlAttr(input.cover.id)}" href="${xmlAttr(input.cover.href)}" media-type="${input.cover.mime}" properties="cover-image"/>`,
    `    <item id="cover" href="${xmlAttr(input.coverPageHref)}" media-type="application/xhtml+xml"${input.coverUsesSvg ? ' properties="svg"' : ''}/>`,
    `    <item id="nav" href="${xmlAttr(input.navHref)}" media-type="application/xhtml+xml" properties="nav"/>`,
    `    <item id="ncx" href="${xmlAttr(input.ncxHref)}" media-type="application/x-dtbncx+xml"/>`,
    `    <item id="css" href="${xmlAttr(input.cssHref)}" media-type="text/css"/>`,
    ...input.chapters.map(
      (c) => `    <item id="${xmlAttr(c.id)}" href="${xmlAttr(c.href)}" media-type="application/xhtml+xml"/>`,
    ),
    ...input.images.map(
      (img) => `    <item id="${xmlAttr(img.id)}" href="${xmlAttr(img.href)}" media-type="${img.mime}"/>`,
    ),
  ].join('\n');

  const spineLines = [
    '    <itemref idref="cover" linear="yes"/>',
    '    <itemref idref="nav" linear="yes"/>',
    ...input.chapters.map((c) => `    <itemref idref="${xmlAttr(c.id)}"/>`),
  ].join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">urn:uuid:${xmlText(input.uuid)}</dc:identifier>
    <dc:title>${xmlText(input.title)}</dc:title>
${creatorLines}
    <dc:language>${lang}</dc:language>
${input.publisher ? `    <dc:publisher>${xmlText(input.publisher)}</dc:publisher>\n` : ''}${subjectLines ? `${subjectLines}\n` : ''}    <dc:date>${ts}</dc:date>
    <meta property="dcterms:modified">${ts}</meta>
    <!-- EPUB2 cover hook. Unprefixed, and the declaration Kindle actually reads. -->
    <meta name="cover" content="${xmlAttr(input.cover.id)}"/>
  </metadata>
  <manifest>
${manifestLines}
  </manifest>
  <spine toc="ncx">
${spineLines}
  </spine>
  <guide>
    <reference type="cover" title="Cover" href="${xmlAttr(input.coverPageHref)}"/>
    <reference type="toc" title="Table of Contents" href="${xmlAttr(input.navHref)}"/>
    <reference type="text" title="Beginning" href="${xmlAttr(firstChapterHref)}"/>
  </guide>
</package>
`;
}
