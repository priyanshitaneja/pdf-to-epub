/**
 * Derive a download filename from book metadata.
 *
 * Kept separate from archive-internal paths, which must stay ASCII — a download filename may
 * contain non-ASCII safely, so a title like "₹1Cr Roadmap" survives here.
 */
export function epubFilename(title: string, authors: string[], sourceFileName: string): string {
  const cleanTitle = sanitize(title);
  const cleanAuthor = sanitize(authors[0] ?? '');

  let stem = cleanTitle;
  if (cleanTitle.length > 0 && cleanAuthor.length > 0) stem = `${cleanTitle} - ${cleanAuthor}`;

  if (stem.length === 0) stem = sanitize(sourceFileName.replace(/\.pdf$/i, ''));
  if (stem.length === 0) return 'converted.epub';

  return `${stem.slice(0, 120).replace(/[. ]+$/, '')}.epub`;
}

function sanitize(raw: string): string {
  return (
    raw
      // Characters that are illegal or troublesome in filenames across macOS/Windows/Linux,
      // plus C0 controls.
      .replace(/[/\\?%*:|"<>]/g, '')
      .split('')
      .filter((ch) => {
        const cp = ch.codePointAt(0) ?? 0;
        return cp >= 0x20 && cp !== 0x7f;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .replace(/^[. ]+|[. ]+$/g, '')
      .trim()
  );
}
