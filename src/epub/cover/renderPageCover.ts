import type { CoverCandidate } from '../../types/document.ts';
import type { PdfDocument } from '../../pdf/loadDocument.ts';
import { COVER_LONG_EDGE_DEFAULT, fitLongEdge } from './coverDims.ts';
import { canvasToBlob, makeCanvas } from './synthesizeCover.ts';

/** Above this size the cover is re-encoded at lower quality, then at lower resolution. */
const MAX_COVER_BYTES = 2 * 1024 * 1024;

/**
 * Render a PDF page to use as the cover.
 *
 * Tier 2 of the cover chain: used when no full-page embedded image qualifies. Page 1 of a
 * document printed from a browser or a word processor is a real title page, so rendering it
 * gives a cover that looks like the document rather than a generic placeholder.
 */
export async function renderPageCover(
  doc: PdfDocument,
  pageNumber: number,
  longEdgePx: number = COVER_LONG_EDGE_DEFAULT,
): Promise<CoverCandidate | null> {
  const page = await doc.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const target = fitLongEdge(base.width, base.height, longEdgePx);
    const scale = Math.max(target.w / base.width, target.h / base.height);
    const viewport = page.getViewport({ scale });

    const canvas = makeCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return null;

    // PDF pages have no background of their own; without this the render is transparent, which
    // becomes black on most readers.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: ctx, viewport }).promise;

    if (isEffectivelyBlank(ctx, canvas.width, canvas.height)) return null;

    let blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    if (blob.size > MAX_COVER_BYTES) blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);

    const result: CoverCandidate = {
      source: 'rendered-page',
      page: pageNumber - 1,
      blob,
      mime: 'image/jpeg',
      w: canvas.width,
      h: canvas.height,
      lossless: false,
      score: 50,
    };

    // Release the backing store; a 1600x2560 canvas is ~16 MB.
    canvas.width = 0;
    canvas.height = 0;
    return result;
  } finally {
    page.cleanup();
  }
}

/**
 * Detect a page that rendered essentially empty.
 *
 * Many documents open with a blank or near-blank leaf, and a white rectangle is a worse cover
 * than the next page or a generated one. Sampled on a small downscale rather than the full
 * bitmap, since only the gross statistics matter.
 */
function isEffectivelyBlank(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const probe = makeCanvas(32, 32);
  const probeCtx = probe.getContext('2d') as CanvasRenderingContext2D | null;
  if (!probeCtx) return false;

  probeCtx.drawImage(ctx.canvas as unknown as CanvasImageSource, 0, 0, width, height, 0, 0, 32, 32);
  const { data } = probeCtx.getImageData(0, 0, 32, 32);

  let sum = 0;
  const luminances: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    luminances.push(l);
    sum += l;
  }

  const mean = sum / luminances.length;
  const variance =
    luminances.reduce((acc, l) => acc + (l - mean) ** 2, 0) / luminances.length;

  return mean > 250 && Math.sqrt(variance) < 2;
}

/**
 * Resolve a cover for the document, walking the chain until something works.
 *
 * Embedded full-page image extraction (Tier 1, lossless) is milestone M4; until then this goes
 * straight to rendering, then falls through to the caller's synthesized cover. The order is what
 * matters — there is always an answer.
 */
export async function selectCover(
  doc: PdfDocument,
  longEdgePx: number = COVER_LONG_EDGE_DEFAULT,
): Promise<CoverCandidate | null> {
  const pagesToTry = Math.min(doc.numPages, 2);
  for (let pageNumber = 1; pageNumber <= pagesToTry; pageNumber += 1) {
    try {
      const candidate = await renderPageCover(doc, pageNumber, longEdgePx);
      if (candidate) return candidate;
    } catch {
      // A page that will not render is not fatal; try the next, then give up to synthesis.
    }
  }
  return null;
}
