/**
 * Derive a download filename from book metadata.
 *
 * Kept separate from archive-internal paths, which must stay ASCII — a download filename may
 * contain non-ASCII safely, so a title like "₹1Cr Roadmap" survives here.
 */
export function epubFilename(title: string, authors: string[], sourceFileName: string): string {
  const cleanTitle = sanitizeFilenameStem(title);
  const cleanAuthor = sanitizeFilenameStem(authors[0] ?? '');

  let stem = cleanTitle;
  if (cleanTitle.length > 0 && cleanAuthor.length > 0) stem = `${cleanTitle} - ${cleanAuthor}`;

  if (stem.length === 0) stem = sanitizeFilenameStem(sourceFileName.replace(/\.pdf$/i, ''));
  if (stem.length === 0) return 'converted.epub';

  return `${stem.slice(0, FILENAME_STEM_MAX).replace(/[. ]+$/, '')}.epub`;
}

/** Longest stem we emit, leaving room for the extension inside conservative path limits. */
export const FILENAME_STEM_MAX = 120;

/**
 * Strip only the characters that cannot appear in a filename: those that are illegal or
 * troublesome across macOS/Windows/Linux, plus C0 controls.
 *
 * Deliberately leaves whitespace and dots alone, so this is safe to apply on every keystroke of
 * an editable filename field. Collapsing runs of spaces mid-type would make the field impossible
 * to type a two-word name into.
 */
export function stripIllegalFilenameChars(raw: string): string {
  return raw
    .replace(/[/\\?%*:|"<>]/g, '')
    .split('')
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp >= 0x20 && cp !== 0x7f;
    })
    .join('');
}

/**
 * Full normalisation: illegal characters removed, whitespace collapsed, no leading or trailing
 * dots or spaces. For deriving a name, or for settling an edited one once the field loses focus.
 */
export function sanitizeFilenameStem(raw: string): string {
  return stripIllegalFilenameChars(raw)
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim();
}
