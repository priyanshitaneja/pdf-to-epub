/**
 * THE SEAM.
 *
 * The extraction half produces a `DocModel`; the EPUB writer consumes one. Nothing else
 * crosses between them. In particular `src/epub/` must never import pdf.js — if it needs
 * to, this contract is wrong and should be widened here instead.
 *
 * Changing anything in this file is a joint edit across both halves.
 */

/**
 * Canonical page space: upright, y-down, origin top-left, 1 unit = 1 PDF point (1/72").
 *
 * Everything is normalised into this space at ingest — pdf.js text transforms (y-up,
 * rotation unapplied), operator-list geometry (a different CTM), and OCR boxes (device
 * pixels) all land here, so no downstream stage ever reasons about PDF coordinates.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Which extraction strategy produced a block.
 *
 * - `A` — tagged PDF: read from the producer's own structure tree. Near-perfect.
 * - `B` — untagged with a text layer: geometric heuristics.
 * - `C` — no text layer: OCR.
 *
 * Tiers are per-page, not per-document: a scanned appendix inside a born-digital report
 * is common.
 */
export type Tier = 'A' | 'B' | 'C';

export interface Provenance {
  /** 0-based source page. */
  page: number;
  tier: Tier;
  rect?: Rect;
  /** 1.0 for Tier A; heuristic score for Tier B; mean OCR confidence for Tier C. */
  confidence: number;
}

/* ------------------------------------------------------------------ inline ---- */

export type Inline =
  | InlineText
  | InlineLink
  | InlineImage
  | InlineBreak;

export interface InlineText {
  t: 'text';
  s: string;
  b?: true;
  i?: true;
  code?: true;
  sup?: true;
  sub?: true;
}

export interface InlineLink {
  t: 'link';
  href: string;
  internal: boolean;
  children: Inline[];
  /** Set for internal links; resolved to a chapter href + fragment by the writer. */
  targetBlockId?: string;
}

/**
 * An inline image — in practice a snapshotted equation.
 *
 * `baselineRatio` and `widthEm` let the writer emit `vertical-align` and an em-relative
 * width, so the snapshot sits on the text baseline and scales with the reader's font size
 * instead of being pinned to a pixel height.
 */
export interface InlineImage {
  t: 'img';
  assetId: string;
  alt: string;
  baselineRatio?: number;
  widthEm?: number;
}

export interface InlineBreak {
  t: 'br';
}

/* ------------------------------------------------------------------ blocks ---- */

export interface BlockBase {
  id: string;
  prov: Provenance;
}

export interface ParagraphBlock extends BlockBase {
  kind: 'p';
  inlines: Inline[];
  align?: 'left' | 'center' | 'right' | 'justify';
}

export interface HeadingBlock extends BlockBase {
  kind: 'h';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  inlines: Inline[];
  /** Stable id used as the TOC anchor target. */
  anchor: string;
}

export interface ListItem {
  id: string;
  blocks: Block[];
}

export interface ListBlock extends BlockBase {
  kind: 'list';
  ordered: boolean;
  start?: number;
  items: ListItem[];
}

export interface TableCell {
  header: boolean;
  colspan: number;
  rowspan: number;
  align?: 'left' | 'center' | 'right';
  blocks: Block[];
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableBlock extends BlockBase {
  kind: 'table';
  head: TableRow[];
  body: TableRow[];
  caption?: Inline[];
  /**
   * How the table was recovered. Drives the conversion report: `tagged` is trustworthy,
   * `ruled` is usually right, `aligned` is the guess.
   */
  source: 'tagged' | 'ruled' | 'aligned';
}

export interface FigureBlock extends BlockBase {
  kind: 'figure';
  assetId: string;
  alt: string;
  caption?: Inline[];
  wPt: number;
  hPt: number;
}

export interface CodeBlock extends BlockBase {
  kind: 'code';
  text: string;
  lang?: string;
}

/**
 * The table fallback: monospace text preserving the original column spacing, optionally
 * with a raster snapshot of the region attached.
 *
 * This exists because a garbled `<table>` is worse output than an honest monospace block.
 * Untagged table detection is the least reliable stage in the pipeline, so it must always
 * have somewhere to fail to.
 */
export interface PreBlock extends BlockBase {
  kind: 'pre';
  text: string;
  snapshotAssetId?: string;
}

export interface QuoteBlock extends BlockBase {
  kind: 'quote';
  blocks: Block[];
}

export interface RuleBlock extends BlockBase {
  kind: 'rule';
}

/** Emitted at every source page boundary; feeds print-page anchors in the EPUB. */
export interface PageBreakBlock extends BlockBase {
  kind: 'pagebreak';
  sourcePage: number;
  label?: string;
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | TableBlock
  | FigureBlock
  | CodeBlock
  | PreBlock
  | QuoteBlock
  | RuleBlock
  | PageBreakBlock;

/* ------------------------------------------------------------------ assets ---- */

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/svg+xml';

export interface Asset {
  id: string;
  /**
   * A `Blob`, deliberately, not a `Uint8Array`. Blobs live off the JS heap and are
   * disk-backed in Chrome — the difference between finishing and running out of memory on
   * a 400-page illustrated PDF.
   */
  blob: Blob;
  mime: ImageMime;
  w: number;
  h: number;
  /** 64-bit average hash, hex encoded. Used to dedupe repeated figures and drop watermarks. */
  hash: string;
  /** True when `blob` holds the original embedded stream, never decoded and re-encoded. */
  lossless: boolean;
  /** True when the image covers >=85% of its page box, making it a cover candidate. */
  isFullPageCandidate: boolean;
  /** 0-based source page. */
  page: number;
}

/* -------------------------------------------------------------- metadata ------ */

export type TitleSource = 'xmp' | 'info' | 'first-heading' | 'filename';

export interface DocMeta {
  title: string;
  authors: string[];
  /** BCP-47. Defaults to 'en'. */
  language: string;
  /** `urn:uuid:...` */
  identifier: string;
  publisher?: string;
  subjects?: string[];
  producer?: string;
  sourceFileName: string;
  sourcePageCount: number;
  /**
   * Where the title came from. The UI badges anything weaker than `xmp`/`info`, because a
   * garbage `dc:title` is the top reason a Kindle library looks wrong.
   */
  titleSource: TitleSource;
}

export interface TocEntry {
  anchor: string;
  label: string;
  level: number;
  children: TocEntry[];
}

/* ---------------------------------------------------------------- report ------ */

export type WarningCode =
  | 'low-ocr-confidence'
  | 'table-fallback'
  | 'image-unresolved'
  | 'rotated-text'
  | 'struct-coverage-low'
  | 'space-heuristic-uncertain'
  | 'unresolved-link'
  | 'page-skipped';

export interface Warning {
  page: number;
  code: WarningCode;
  message: string;
}

export interface ConversionStats {
  paragraphs: number;
  headings: number;
  tables: number;
  tablesFellBackToPre: number;
  figures: number;
  ocrPages: number;
  meanOcrConfidence?: number;
  /** Text that was seen but never placed into a block. High values mean something broke. */
  unassignedTextRatio: number;
}

/**
 * A first-class output, not a debug afterthought.
 *
 * Every table that fell back, every low-confidence OCR page and every unresolved link is
 * counted here and shown in the UI. Users forgive imperfect conversion; they don't forgive
 * *silent* imperfect conversion.
 */
export interface ConversionReport {
  tierByPage: Tier[];
  warnings: Warning[];
  stats: ConversionStats;
  durationMs: number;
}

/* ----------------------------------------------------------------- model ------ */

export interface DocModel {
  meta: DocMeta;
  blocks: Block[];
  assets: Asset[];
  toc: TocEntry[];
  report: ConversionReport;
}

/* ------------------------------------------------------- cover capability ----- */

export type CoverSource = 'embedded-xobject' | 'rendered-page' | 'synthesized' | 'user-upload';

export interface CoverCandidate {
  source: CoverSource;
  /** 0-based source page, where one applies. */
  page?: number;
  blob: Blob;
  mime: ImageMime;
  w: number;
  h: number;
  lossless: boolean;
  score: number;
}

/**
 * The two capabilities the writer needs from the extraction side beyond plain data.
 *
 * `renderPage` backs three separate things — the cover render fallback, the cover
 * page-picker grid, and region snapshots for tables and equations — so it is built once
 * and shared.
 */
export interface CoverSourceApi {
  getEmbeddedCoverCandidates(): Promise<CoverCandidate[]>;
  renderPage(page: number, opts: { longEdgePx: number }): Promise<CoverCandidate>;
  renderThumbnails(pages: number[], longEdgePx: number): Promise<Map<number, Blob>>;
}
