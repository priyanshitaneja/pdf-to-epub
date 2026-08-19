/**
 * Read intrinsic dimensions straight from image bytes.
 *
 * The cover checks previously trusted magic bytes alone, which meant an 8-byte file containing
 * nothing but a PNG signature passed as a valid cover — and Kindle showed no cover at all. Magic
 * bytes prove the format label is honest; they say nothing about whether there is an image.
 *
 * Deliberately parses only the headers, so it stays cheap and needs no decoder.
 */

export interface ImageProbe {
  mime: 'image/jpeg' | 'image/png' | 'image/gif';
  width: number;
  height: number;
}

export function probeImage(bytes: Uint8Array): ImageProbe | null {
  return probePng(bytes) ?? probeJpeg(bytes) ?? probeGif(bytes);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function probePng(bytes: Uint8Array): ImageProbe | null {
  if (bytes.length < 24) return null;
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return null;

  // The IHDR chunk must be first, and carries width/height as big-endian uint32.
  const type = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (type !== 'IHDR') return null;

  return { mime: 'image/png', width: readU32(bytes, 16), height: readU32(bytes, 20) };
}

function probeJpeg(bytes: Uint8Array): ImageProbe | null {
  if (bytes.length < 4) return null;
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return null;

  // Walk the marker segments looking for a Start-Of-Frame, which holds the dimensions.
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;

    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // SOF0..SOF15, excluding the DHT/DAC/DNL markers that share the range.
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        mime: 'image/jpeg',
        height: readU16(bytes, offset + 5),
        width: readU16(bytes, offset + 7),
      };
    }
    const length = readU16(bytes, offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function probeGif(bytes: Uint8Array): ImageProbe | null {
  if (bytes.length < 10) return null;
  const header = String.fromCharCode(...bytes.subarray(0, 6));
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;
  // GIF stores the logical screen size little-endian.
  return {
    mime: 'image/gif',
    width: bytes[6]! | (bytes[7]! << 8),
    height: bytes[8]! | (bytes[9]! << 8),
  };
}

function readU32(bytes: Uint8Array, at: number): number {
  return ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
}

function readU16(bytes: Uint8Array, at: number): number {
  return (bytes[at]! << 8) | bytes[at + 1]!;
}
