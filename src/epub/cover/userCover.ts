import type { CoverCandidate } from '../../types/document.ts';
import { probeImage } from '../validate/imageProbe.ts';
import { COVER_LONG_EDGE_HIGH, COVER_MAX_BYTES, fitLongEdge } from './coverDims.ts';
import { canvasToBlob, makeCanvas } from './synthesizeCover.ts';

/** What the file input offers. Extensions included because Windows often reports no MIME type. */
export const USER_COVER_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

/**
 * Generous, because this is a photograph or a piece of artwork rather than a document, and the
 * whole file is decoded in memory.
 */
export const USER_COVER_MAX_BYTES = 25 * 1024 * 1024;

/** Below this the validator errors outright, so it is rejected here with a better message. */
const MIN_EDGE_PX = 100;

/** Beats every generated candidate: an explicit choice outranks anything inferred. */
const USER_COVER_SCORE = 100;

/**
 * Turn a user-chosen image file into a cover candidate.
 *
 * Always re-encodes to JPEG rather than embedding the original bytes, which is worth explaining
 * because passing them through would seem better:
 *
 * - Kindle prefers JPEG, and it is the only format the rest of this pipeline emits.
 * - JPEG has no alpha channel. A transparent PNG drawn without a background becomes black.
 * - `probeImage` reads dimensions from the file header, but `createImageBitmap` applies EXIF
 *   orientation. For a rotated photo those two disagree, and the cover page's SVG viewBox is built
 *   from the dimensions we report. Re-encoding through a canvas makes the reported dimensions
 *   exactly the encoded ones, so the disagreement cannot arise.
 * - The validator compares the OPF's declared media type against the bytes it finds, by string
 *   equality. Emitting one format removes any chance of a mismatch.
 *
 * Throws with a message meant to be shown to the user.
 */
export async function coverFromFile(file: File): Promise<CoverCandidate> {
  if (file.size > USER_COVER_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(0);
    const limit = (USER_COVER_MAX_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(`"${file.name}" is ${mb} MB. The limit for a cover image is ${limit} MB.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  /*
   * SVG is in `ImageMime` and would pass the manifest, but `probeImage` has no SVG branch, so the
   * validator would fail it as undecodable and block the download. Refusing here explains why.
   */
  if (looksLikeSvg(file, bytes)) {
    throw new Error(
      'SVG cannot be used as a cover, because Kindle will not decode one. Export it as a JPEG or PNG first.',
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`"${file.name}" could not be read as an image.`);
  }

  try {
    if (bitmap.width < MIN_EDGE_PX || bitmap.height < MIN_EDGE_PX) {
      throw new Error(
        `That image is ${bitmap.width} by ${bitmap.height} pixels. A cover needs at least ${MIN_EDGE_PX} on each edge, and 1600 by 2560 is what Amazon recommends.`,
      );
    }

    /*
     * Targets the high setting rather than the 1600px default: a cover the user chose deliberately
     * is worth keeping at Amazon's recommended 2560. `fitLongEdge` never upscales, so a smaller
     * image is left at its own size and simply flagged as low resolution by the validator.
     */
    const fitted = fitLongEdge(bitmap.width, bitmap.height, COVER_LONG_EDGE_HIGH);

    const canvas = makeCanvas(fitted.w, fitted.h);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error('This browser would not provide a canvas to read the image with.');

    // See above: JPEG has no alpha, and an unfilled canvas becomes black rather than transparent.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, fitted.w, fitted.h);
    ctx.drawImage(bitmap, 0, 0, fitted.w, fitted.h);

    let blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    if (blob.size > COVER_MAX_BYTES) blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);

    return {
      source: 'user-upload',
      blob,
      mime: 'image/jpeg',
      w: fitted.w,
      h: fitted.h,
      // Re-encoded by definition, so this never claims original quality.
      lossless: false,
      score: USER_COVER_SCORE,
    };
  } finally {
    // Release the decoded pixels; a 2560px cover is on the order of 16 MB.
    bitmap.close();
  }
}

/**
 * Detect SVG from the bytes as well as the reported type.
 *
 * An SVG renamed to .png reports whatever the OS guesses, and `probeImage` returning null is the
 * symptom rather than the cause, so the sniff earns its place.
 */
function looksLikeSvg(file: File, bytes: Uint8Array): boolean {
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) return true;
  if (probeImage(bytes) !== null) return false;

  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart()
    .toLowerCase();

  return head.startsWith('<?xml') || head.startsWith('<svg');
}
