import type { ValidationIssue } from './types.ts';
import { MIMETYPE_CONTENT } from '../zip.ts';

const LOCAL_HEADER_LEN = 30;
const MIMETYPE_NAME = 'mimetype';
const HEADER_SLICE = LOCAL_HEADER_LEN + MIMETYPE_NAME.length + MIMETYPE_CONTENT.length;

/**
 * Verify the first bytes of the archive directly, rather than trusting the zip library.
 *
 * The EPUB spec requires the `mimetype` entry to be first, stored uncompressed, with an
 * empty extra field, so that a reader can identify the file by reading a fixed byte range
 * without parsing the central directory. Every field below is checked at its exact offset.
 */
export async function checkMimetypeBytes(blob: Blob): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const head = new Uint8Array(await blob.slice(0, HEADER_SLICE).arrayBuffer());

  if (head.length < HEADER_SLICE) {
    return [
      {
        severity: 'error',
        code: 'zip-truncated',
        message: `Archive is too short to contain a valid mimetype entry (${head.length} bytes).`,
      },
    ];
  }

  const u16 = (offset: number) => head[offset]! | (head[offset + 1]! << 8);

  if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
    issues.push({
      severity: 'error',
      code: 'zip-magic',
      message: 'Archive does not begin with a local file header (PK\\x03\\x04).',
    });
  }

  const flags = u16(6);
  if (flags !== 0) {
    issues.push({
      severity: 'error',
      code: 'mimetype-flags',
      message: `General-purpose flags on the mimetype entry must be 0, got 0x${flags.toString(16)}. Bit 3 means a trailing data descriptor, which strict readers reject.`,
    });
  }

  const method = u16(8);
  if (method !== 0) {
    issues.push({
      severity: 'error',
      code: 'mimetype-compressed',
      message: `The mimetype entry must be STORED (method 0), got method ${method}.`,
    });
  }

  const nameLen = u16(26);
  if (nameLen !== MIMETYPE_NAME.length) {
    issues.push({
      severity: 'error',
      code: 'mimetype-not-first',
      message: `First entry's filename length is ${nameLen}, expected ${MIMETYPE_NAME.length} — mimetype is not the first entry.`,
    });
  }

  const extraLen = u16(28);
  if (extraLen !== 0) {
    issues.push({
      severity: 'error',
      code: 'mimetype-extra-field',
      message: `The mimetype entry must have an empty extra field, got ${extraLen} bytes.`,
    });
  }

  const decoder = new TextDecoder();
  const name = decoder.decode(head.subarray(LOCAL_HEADER_LEN, LOCAL_HEADER_LEN + MIMETYPE_NAME.length));
  if (name !== MIMETYPE_NAME) {
    issues.push({
      severity: 'error',
      code: 'mimetype-not-first',
      message: `First entry is "${name}", expected "mimetype".`,
    });
  } else {
    const start = LOCAL_HEADER_LEN + MIMETYPE_NAME.length;
    const content = decoder.decode(head.subarray(start, start + MIMETYPE_CONTENT.length));
    if (content !== MIMETYPE_CONTENT) {
      issues.push({
        severity: 'error',
        code: 'mimetype-content',
        message: `mimetype content is "${content}", expected "${MIMETYPE_CONTENT}".`,
      });
    }
  }

  return issues;
}
