import JSZip from 'jszip';

export interface EpubFile {
  /** Path inside the archive. Must be ASCII — see the note on the extra field below. */
  path: string;
  data: string | Uint8Array | Blob;
}

/** Fixed timestamp so the same input always produces a byte-identical archive. */
const EPOCH = new Date('2024-01-01T00:00:00Z');

export const MIMETYPE_CONTENT = 'application/epub+zip';

/**
 * Package an EPUB.
 *
 * The EPUB spec has one genuinely fiddly requirement: the `mimetype` entry must be the
 * archive's **first** entry, stored uncompressed, with an empty extra field. Readers that
 * check this reject the file outright when it is wrong, and the failure looks like a
 * corrupt book rather than a spec violation.
 *
 * Four details here are load-bearing:
 *
 * - **Insertion order.** It is the only control JSZip gives over entry order, so `mimetype`
 *   is added before anything else touches the archive.
 * - **`compression: 'STORE'`** per file, overriding the DEFLATE default passed to
 *   `generateAsync`.
 * - **`streamFiles: false`.** With `true`, JSZip writes sizes and CRCs to a trailing data
 *   descriptor and sets general-purpose flag bit 3. That is legal zip but breaks strict
 *   EPUB readers, and it defeats the byte check in the validator.
 * - **ASCII paths.** A non-ASCII name makes JSZip emit a Unicode Path extra field, which
 *   would give the mimetype entry a non-empty extra field. Internal paths are therefore
 *   never derived from user-supplied text such as the PDF title.
 */
export async function packEpub(files: EpubFile[]): Promise<Blob> {
  const zip = new JSZip();

  zip.file('mimetype', MIMETYPE_CONTENT, {
    compression: 'STORE',
    createFolders: false,
    date: EPOCH,
    binary: false,
  });

  for (const file of files) {
    if (file.path === 'mimetype') {
      throw new Error('mimetype is added automatically and must not be supplied');
    }
    assertAsciiPath(file.path);
    zip.file(file.path, file.data, {
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      createFolders: false,
      date: EPOCH,
      binary: typeof file.data !== 'string',
    });
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: MIMETYPE_CONTENT,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    streamFiles: false,
    platform: 'DOS',
  });
}

function assertAsciiPath(path: string): void {
  // eslint-disable-next-line no-control-regex
  if (!/^[\x20-\x7e]+$/.test(path)) {
    throw new Error(`EPUB internal paths must be ASCII, got: ${JSON.stringify(path)}`);
  }
}

/**
 * Sanitize a string into a safe archive path segment.
 *
 * Used for image ids and similar. Anything outside a conservative ASCII set collapses to a
 * hyphen, which keeps the Unicode Path extra field from ever appearing.
 */
export function asciiPathSegment(raw: string, fallback = 'asset'): string {
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned.length > 0 ? cleaned : fallback;
}
