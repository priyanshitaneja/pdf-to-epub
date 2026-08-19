import { deflateSync } from 'node:zlib';

/**
 * Encode a solid-colour PNG without a canvas.
 *
 * Needed because the browser cover path uses `OffscreenCanvas`, which does not exist in Node —
 * so tests and CLI-emitted artifacts previously used a hand-written byte stub as a stand-in.
 * That stub was only a PNG signature with no image data, and it silently became the cover of a
 * shipped EPUB. Generating a genuine PNG removes the temptation to fake one.
 *
 * Node-only (it uses `node:zlib`); the browser builds its cover on a canvas instead.
 */
export function writeSolidPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  let at = 0;
  for (let y = 0; y < height; y += 1) {
    raw[at++] = 0; // filter type: none
    for (let x = 0; x < width; x += 1) {
      raw[at++] = rgb[0];
      raw[at++] = rgb[1];
      raw[at++] = rgb[2];
    }
  }

  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  writeU32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeU32(target: Uint8Array, at: number, value: number): void {
  target[at] = (value >>> 24) & 0xff;
  target[at + 1] = (value >>> 16) & 0xff;
  target[at + 2] = (value >>> 8) & 0xff;
  target[at + 3] = value & 0xff;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
