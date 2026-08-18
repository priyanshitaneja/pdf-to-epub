import type { CoverCandidate } from '../../types/document.ts';
import { COVER_LONG_EDGE_HIGH } from './coverDims.ts';

export interface SynthesizeInput {
  title: string;
  authors: string[];
  /** Deterministic accent derived from the title, so the same book always looks the same. */
  seed?: string;
}

const WIDTH = Math.round(COVER_LONG_EDGE_HIGH / 1.6);
const HEIGHT = COVER_LONG_EDGE_HIGH;

/**
 * Draw a typographic cover from the title and author.
 *
 * This is the last link in the cover chain and it cannot fail, which is the point: the answer
 * to "does this book have a cover?" must always be yes. A grey placeholder in the Kindle
 * library is the exact outcome this tool exists to avoid, so shipping an EPUB with no cover
 * at all is never an option.
 */
export async function synthesizeCover(input: SynthesizeInput): Promise<CoverCandidate> {
  const canvas = makeCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('Could not obtain a 2D context to synthesize a cover');

  const hue = hashHue(input.seed ?? input.title);

  ctx.fillStyle = `hsl(${hue} 32% 22%)`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A restrained band near the top, so the result reads as a designed cover rather than an
  // error state.
  ctx.fillStyle = `hsl(${hue} 48% 46%)`;
  ctx.fillRect(0, Math.round(HEIGHT * 0.16), WIDTH, 12);

  const margin = Math.round(WIDTH * 0.11);
  const maxWidth = WIDTH - margin * 2;

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  const titleSize = Math.round(WIDTH * 0.095);
  ctx.font = `600 ${titleSize}px Helvetica, Arial, sans-serif`;
  const lines = wrapText(ctx, input.title || 'Untitled', maxWidth).slice(0, 6);
  let y = Math.round(HEIGHT * 0.22);
  for (const line of lines) {
    ctx.fillText(line, margin, y);
    y += Math.round(titleSize * 1.22);
  }

  const author = input.authors.filter((a) => a.trim().length > 0).join(', ');
  if (author.length > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    const authorSize = Math.round(WIDTH * 0.05);
    ctx.font = `400 ${authorSize}px Helvetica, Arial, sans-serif`;
    for (const line of wrapText(ctx, author, maxWidth).slice(0, 2)) {
      ctx.fillText(line, margin, y + Math.round(authorSize * 0.9));
      y += Math.round(authorSize * 1.25);
    }
  }

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return {
    source: 'synthesized',
    blob,
    mime: 'image/jpeg',
    w: WIDTH,
    h: HEIGHT,
    lossless: false,
    score: 0,
  };
}

function wrapText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth || current.length === 0) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Small stable hash so a given title always yields the same colour. */
function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Encode a canvas to a Blob.
 *
 * `OffscreenCanvas.convertToBlob` is unavailable on older Safari, so the DOM canvas path is
 * a real fallback rather than dead code.
 */
export async function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }
  const el = canvas as HTMLCanvasElement;
  return new Promise<Blob>((resolve, reject) => {
    el.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      type,
      quality,
    );
  });
}
