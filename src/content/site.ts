/**
 * Site-level identity, in one place.
 *
 * Every canonical URL, Open Graph URL and sitemap entry derives from `SITE_URL`, so moving to a
 * custom domain later is a single environment variable rather than a search-and-replace. The
 * fallback is the current production origin; `VITE_SITE_URL` overrides it.
 */
const RAW_SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://pdf-to-epub-blue.vercel.app';

/** Normalised without a trailing slash, so `${SITE_URL}${path}` is always well formed. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');

/**
 * The name used in structured data and Open Graph. Descriptive rather than clever: people search
 * for what a thing does, and an answer engine citing "PDF to EPUB for Kindle" is more useful to
 * the reader than one citing an invented brand.
 */
export const SITE_NAME = 'PDF to EPUB for Kindle';

export const AUTHOR_NAME = 'Priyanshi Taneja';
export const REPO_URL = 'https://github.com/priyanshitaneja/pdf-to-epub';

/** Upper bound enforced by the dropzone, quoted in copy because it is a real constraint. */
export const MAX_FILE_MB = 200;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
