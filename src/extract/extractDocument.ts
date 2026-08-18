import type {
  Asset,
  Block,
  DocMeta,
  DocModel,
  Tier,
  Warning,
} from '../types/document.ts';
import type { Matrix } from '../pdf/geometry.ts';
import type { PdfDocument } from '../pdf/loadDocument.ts';
import { textContentToRuns, type PdfFontStyle, type PdfTextContentItem } from '../pdf/textToRuns.ts';
import { createThresholdCache } from './tierB/glyphJoin.ts';
import { assembleLines } from './tierB/lines.ts';
import type { Line } from './types.ts';
import { assembleParagraphs, flushPending, type PendingParagraph } from './tierB/paragraphs.ts';
import { detectHeadings, modalBodyEm } from './tierB/headings.ts';
import { buildToc } from '../epub/split/toc.ts';

export interface ExtractProgress {
  (update: { page: number; pageCount: number; detail: string }): void;
}

export interface ExtractOptions {
  fileName: string;
  onProgress?: ExtractProgress;
  /** Checked between pages so a long job can be abandoned. */
  isCancelled?: () => boolean;
}

/**
 * Read a whole PDF into a `DocModel`.
 *
 * One page at a time, releasing each page before moving on: holding every page's text content
 * and operator list is what makes large documents run out of memory. The threshold cache is the
 * one thing deliberately carried across pages, so a short line on page 40 can borrow the
 * spacing calibration derived from the body font earlier.
 */
export async function extractDocument(
  doc: PdfDocument,
  options: ExtractOptions,
): Promise<DocModel> {
  const started = Date.now();
  const pageCount = doc.numPages;

  const cache = createThresholdCache();
  const warnings: Warning[] = [];
  const tierByPage: Tier[] = [];
  const blocks: Block[] = [];
  const assets: Asset[] = [];

  let detrackedTotal = 0;

  // Phase 1: read every page into lines.
  //
  // Heading detection has to be document-wide, not per-page: body-text size and the
  // "does this document number its headings" decision are both properties of the whole
  // document. Deciding them per page gives the same visual heading different levels on
  // different pages, which produces a nonsense TOC - observed on the roadmap PDF, where a
  // "1.2" subsection became a top-level chapter because its page happened to contain fewer
  // than three numbered headings.
  //
  // Lines are cheap to retain compared with the page content they came from, which is still
  // released immediately. When OCR lands this phase will need to stream instead.
  const pageLines: Array<{ page: number; lines: Line[] }> = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    if (options.isCancelled?.()) break;

    const pageIndex = pageNumber - 1;
    options.onProgress?.({
      page: pageIndex,
      pageCount,
      detail: `Reading page ${pageNumber} of ${pageCount}`,
    });

    const page = await doc.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ includeMarkedContent: true });

      const { runs } = textContentToRuns(
        content.items as unknown as PdfTextContentItem[],
        content.styles as Record<string, PdfFontStyle | undefined>,
        viewport.transform as Matrix,
      );

      // No text layer at all: a scanned page. OCR is milestone M6; for now the page is recorded
      // as skipped rather than silently dropped, so the report tells the truth.
      const charCount = runs.reduce((n, r) => n + r.str.trim().length, 0);
      if (charCount < 40) {
        tierByPage.push('C');
        warnings.push({
          page: pageIndex,
          code: 'page-skipped',
          message: `Page ${pageNumber} has no extractable text. It is probably scanned; OCR is not enabled yet.`,
        });
        continue;
      }

      tierByPage.push('B');

      const { lines, skewed, uncertainSpacing, detrackedLines } = assembleLines(runs, cache);
      detrackedTotal += detrackedLines;

      if (uncertainSpacing) {
        warnings.push({
          page: pageIndex,
          code: 'space-heuristic-uncertain',
          message: `Word spacing on page ${pageNumber} could not be determined confidently.`,
        });
      }
      if (skewed.length > 0) {
        warnings.push({
          page: pageIndex,
          code: 'rotated-text',
          message: `Page ${pageNumber} contains ${skewed.length} rotated text runs, which were left out.`,
        });
      }

      pageLines.push({ page: pageIndex, lines });
    } finally {
      // Release the page's parsed content before the next iteration.
      page.cleanup();
    }
  }

  // Phase 2: decide heading structure across the whole document, then assemble paragraphs.
  const allLines = pageLines.flatMap((entry) => entry.lines);
  const bodyEm = modalBodyEm(allLines);
  const numberingIsGlobal = usesNumberedHeadings(allLines, bodyEm);

  let pending: PendingParagraph | null = null;
  for (const entry of pageLines) {
    const withHeadings = detectHeadings(entry.lines, bodyEm, numberingIsGlobal);
    const result = assembleParagraphs(withHeadings, { page: entry.page, pending });
    blocks.push(...result.blocks);
    pending = result.pending;
  }

  blocks.push(...flushPending(pending));

  if (detrackedTotal > 0) {
    warnings.push({
      page: 0,
      code: 'space-heuristic-uncertain',
      message: `${detrackedTotal} letter-spaced line${detrackedTotal === 1 ? '' : 's'} were repaired; a word boundary may be missing in each.`,
    });
  }

  const meta = await readMeta(doc, options.fileName, pageCount, blocks);
  const toc = buildToc(blocks);

  return {
    meta,
    blocks,
    assets,
    toc,
    report: {
      tierByPage,
      warnings,
      stats: {
        paragraphs: blocks.filter((b) => b.kind === 'p').length,
        headings: blocks.filter((b) => b.kind === 'h').length,
        tables: 0,
        tablesFellBackToPre: blocks.filter((b) => b.kind === 'pre').length,
        figures: 0,
        ocrPages: 0,
        unassignedTextRatio: 0,
      },
      durationMs: Date.now() - started,
    },
  };
}

/**
 * Decide once, for the whole document, whether headings are numbered.
 *
 * Dot depth beats font size as a hierarchy signal when it is present, but only if the document
 * uses it consistently - so the decision belongs here rather than inside a per-page pass.
 */
function usesNumberedHeadings(lines: Line[], bodyEm: number): boolean {
  const numbered = detectHeadings(lines, bodyEm, false).filter(
    (line) => line.headingLevel !== 0 && /^(\d+(?:\.\d+)*)\s+\S/.test(line.text.trim()),
  );
  return numbered.length >= 3;
}

/**
 * Assemble document metadata, preferring the most trustworthy source available.
 *
 * XMP beats the Info dictionary, which beats the first heading, which beats the filename. The
 * chosen source is recorded so the UI can badge a guessed title — a wrong `dc:title` is the top
 * reason a Kindle library looks wrong, and users need to know when to check it.
 */
async function readMeta(
  doc: PdfDocument,
  fileName: string,
  pageCount: number,
  blocks: Block[],
): Promise<DocMeta> {
  let infoTitle = '';
  let infoAuthor = '';
  let language = 'en';
  let producer: string | undefined;
  let xmpTitle = '';

  try {
    const { info, metadata } = await doc.getMetadata();
    const typed = info as {
      Title?: string;
      Author?: string;
      Language?: string;
      Producer?: string;
    };
    infoTitle = (typed.Title ?? '').trim();
    infoAuthor = (typed.Author ?? '').trim();
    producer = typed.Producer;
    if (typed.Language) language = typed.Language;
    xmpTitle = (metadata?.get('dc:title') ?? '').toString().trim();
  } catch {
    // Metadata is optional; a PDF without it is not an error.
  }

  const firstHeading = blocks.find((b) => b.kind === 'h');
  const headingTitle =
    firstHeading?.kind === 'h'
      ? firstHeading.inlines.map((i) => (i.t === 'text' ? i.s : '')).join('').trim()
      : '';

  const stem = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();

  const [title, titleSource] = xmpTitle
    ? ([xmpTitle, 'xmp'] as const)
    : infoTitle && !looksLikeGarbageTitle(infoTitle)
      ? ([infoTitle, 'info'] as const)
      : headingTitle
        ? ([headingTitle, 'first-heading'] as const)
        : ([stem || 'Untitled', 'filename'] as const);

  return {
    title,
    authors: infoAuthor ? infoAuthor.split(/[,;]/).map((a) => a.trim()).filter(Boolean) : [],
    language,
    identifier: `urn:uuid:${crypto.randomUUID()}`,
    producer,
    sourceFileName: fileName,
    sourcePageCount: pageCount,
    titleSource,
  };
}

/**
 * Reject the titles that PDF producers leave behind.
 *
 * Word and Chrome both write the source filename into `Title`, so a great many PDFs claim to be
 * called "Microsoft Word - draft_v3.docx" or "untitled". Falling through to a detected heading
 * gives a better library entry than honouring those.
 */
function looksLikeGarbageTitle(title: string): boolean {
  return (
    /^(untitled|document\d*|microsoft word|microsoft powerpoint|slide\d*)/i.test(title) ||
    /\.(docx?|pptx?|pages|indd|tex)$/i.test(title)
  );
}
