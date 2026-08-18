import type { DocModel, ImageMime } from '../types/document.ts';
import { serializeBlocks, type BlockContext } from './serialize/block.ts';
import { xhtmlDoc } from './serialize/xml.ts';
import { CONTAINER_XML, OEBPS_DIR, OPF_PATH } from './templates/containerXml.ts';
import { contentOpf, type ManifestImage } from './templates/contentOpf.ts';
import { coverXhtml } from './templates/coverXhtml.ts';
import { navXhtml } from './templates/navXhtml.ts';
import { STYLE_CSS } from './templates/styleCss.ts';
import { tocNcx } from './templates/tocNcx.ts';
import { splitIntoChapters, type Chapter } from './split/chapters.ts';
import { buildToc } from './split/toc.ts';
import { asciiPathSegment, packEpub, type EpubFile } from './zip.ts';
import { epubFilename } from './filename.ts';
import { validateEpub } from './validate/validateEpub.ts';
import type { ValidationResult } from './validate/types.ts';

export interface ResolvedCover {
  blob: Blob;
  mime: ImageMime;
  /** Intrinsic pixel dimensions. Required for a correct SVG viewBox on the cover page. */
  w: number;
  h: number;
}

export interface BuildEpubOptions {
  cover: ResolvedCover;
  /** Overrides from the UI's metadata panel. */
  metaOverrides?: { title?: string; authors?: string[]; language?: string };
  coverMarkup?: 'svg' | 'img';
  /** Injectable so tests are deterministic. */
  now?: Date;
  uuid?: string;
}

export interface EpubBuildResult {
  blob: Blob;
  filename: string;
  chapters: Chapter[];
  validation: ValidationResult;
  /** Chapter href -> generated XHTML, for the preview pane. */
  previewByHref: Map<string, string>;
}

const EXT_BY_MIME: Record<ImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/**
 * Assemble a complete EPUB from a `DocModel`, then validate it.
 *
 * The cover arrives already resolved: selecting it needs canvas and pdf.js, which belong to
 * the extraction side. Keeping that out of here is what lets the whole writer be tested in
 * jsdom against a fixture.
 */
export async function buildEpub(
  doc: DocModel,
  options: BuildEpubOptions,
): Promise<EpubBuildResult> {
  const title = options.metaOverrides?.title?.trim() || doc.meta.title || 'Untitled';
  const authors = options.metaOverrides?.authors ?? doc.meta.authors;
  const language = options.metaOverrides?.language?.trim() || doc.meta.language || 'en';
  const uuid = options.uuid ?? extractUuid(doc.meta.identifier) ?? crypto.randomUUID();
  const coverMarkup = options.coverMarkup ?? 'svg';

  // --- assets --------------------------------------------------------------
  const coverExt = EXT_BY_MIME[options.cover.mime];
  const coverHref = `images/cover.${coverExt}`;
  const assetHrefs = new Map<string, string>();
  const manifestImages: ManifestImage[] = [];

  const usedNames = new Set<string>([`cover.${coverExt}`]);
  for (const asset of doc.assets) {
    const ext = EXT_BY_MIME[asset.mime];
    const base = asciiPathSegment(asset.id, 'img');
    let name = `${base}.${ext}`;
    let n = 1;
    while (usedNames.has(name)) name = `${base}-${n++}.${ext}`;
    usedNames.add(name);

    const href = `images/${name}`;
    assetHrefs.set(asset.id, href);
    manifestImages.push({ id: `img-${base}`, href, mime: asset.mime });
  }

  // --- structure -----------------------------------------------------------
  const toc = doc.toc.length > 0 ? doc.toc : buildToc(doc.blocks);
  const split = splitIntoChapters(doc.blocks, title);

  const headingIdFor = (anchor: string) => `h-${asciiPathSegment(anchor, 'h')}`;

  /** Map a heading block id to its anchor id, for internal link targets. */
  const anchorByBlockId = new Map<string, string>();
  for (const chapter of split.chapters) {
    for (const block of chapter.blocks) {
      if (block.kind === 'h') anchorByBlockId.set(block.id, headingIdFor(block.anchor));
    }
  }

  const hrefForAnchor = (anchor: string): string => {
    if (anchor === '__cover__') return 'cover.xhtml';
    const chapterHref = split.anchorToHref.get(anchor);
    if (!chapterHref) return split.chapters[0]?.href ?? 'cover.xhtml';
    return `${chapterHref}#${headingIdFor(anchor)}`;
  };

  // --- chapter documents ---------------------------------------------------
  const previewByHref = new Map<string, string>();
  const files: EpubFile[] = [];

  for (const chapter of split.chapters) {
    const ctx: BlockContext = {
      headingId: headingIdFor,
      assetHref: (assetId) => assetHrefs.get(assetId) ?? null,
      resolveInternal: (blockId) => {
        const targetHref = split.blockToHref.get(blockId);
        if (!targetHref) return null;
        const anchor = anchorByBlockId.get(blockId);
        // Only headings carry an id in the output, so a link to a non-heading block can
        // only be resolved to the top of its chapter file — and not at all if that is the
        // current file, where it would be a no-op.
        if (anchor === undefined) return targetHref === chapter.href ? null : targetHref;
        return targetHref === chapter.href ? `#${anchor}` : `${targetHref}#${anchor}`;
      },
    };

    const xhtml = xhtmlDoc({
      title: chapter.title,
      lang: language,
      stylesheetHref: 'style.css',
      body: serializeBlocks(chapter.blocks, ctx, '  '),
    });

    previewByHref.set(chapter.href, xhtml);
    files.push({ path: `${OEBPS_DIR}/${chapter.href}`, data: xhtml });
  }

  // --- package documents ---------------------------------------------------
  const coverPage = coverXhtml({
    lang: language,
    imageHref: coverHref,
    widthPx: options.cover.w,
    heightPx: options.cover.h,
    alt: `Cover of ${title}`,
    markup: coverMarkup,
  });
  previewByHref.set('cover.xhtml', coverPage);

  const nav = navXhtml({
    lang: language,
    toc,
    hrefFor: hrefForAnchor,
    coverPageHref: 'cover.xhtml',
    firstChapterHref: split.chapters[0]?.href ?? 'cover.xhtml',
    cssHref: 'style.css',
  });

  const ncx = tocNcx({
    uuid,
    title,
    authors,
    lang: language,
    toc,
    hrefFor: hrefForAnchor,
    coverPageHref: 'cover.xhtml',
  });

  const opf = contentOpf({
    uuid,
    title,
    authors,
    language,
    publisher: doc.meta.publisher,
    subjects: doc.meta.subjects,
    modified: options.now,
    chapters: split.chapters.map((c) => ({ id: c.id, href: c.href })),
    images: manifestImages,
    cover: { id: 'cover-img', href: coverHref, mime: options.cover.mime },
    coverUsesSvg: coverMarkup === 'svg',
    navHref: 'nav.xhtml',
    ncxHref: 'toc.ncx',
    cssHref: 'style.css',
    coverPageHref: 'cover.xhtml',
  });

  files.unshift(
    { path: 'META-INF/container.xml', data: CONTAINER_XML },
    { path: OPF_PATH, data: opf },
    { path: `${OEBPS_DIR}/cover.xhtml`, data: coverPage },
    { path: `${OEBPS_DIR}/nav.xhtml`, data: nav },
    { path: `${OEBPS_DIR}/toc.ncx`, data: ncx },
    { path: `${OEBPS_DIR}/style.css`, data: STYLE_CSS },
    { path: `${OEBPS_DIR}/${coverHref}`, data: options.cover.blob },
  );

  for (const asset of doc.assets) {
    const href = assetHrefs.get(asset.id);
    if (href) files.push({ path: `${OEBPS_DIR}/${href}`, data: asset.blob });
  }

  const blob = await packEpub(files);
  const validation = await validateEpub(blob);

  return {
    blob,
    filename: epubFilename(title, authors, doc.meta.sourceFileName),
    chapters: split.chapters,
    validation,
    previewByHref,
  };
}

function extractUuid(identifier: string): string | null {
  const match = /^urn:uuid:([0-9a-fA-F-]{36})$/.exec(identifier);
  return match ? match[1]! : null;
}
