import { SITE_NAME, absoluteUrl } from '../content/site.ts';

export interface HeadInput {
  /** Route path, leading slash, no trailing slash except for the root. */
  path: string;
  title: string;
  description: string;
  ogType: 'website' | 'article';
  /** Resolved base path for same-origin assets. Always ends in a slash. */
  base: string;
  /**
   * True for mirror deploys. The GitHub Pages copy serves the same build from a different origin,
   * and two indexable copies of one page compete with each other, so the mirror is marked noindex
   * while still pointing its canonical at the real origin.
   */
  noindex: boolean;
  /**
   * Vercel Analytics. The script is proxied by Vercel under the site's own origin, so it adds no
   * third-party connection, and it is the only reason this flag exists rather than being on always:
   * the path does not resolve anywhere else.
   */
  analytics: boolean;
}

/** Escapes a value for use inside a double-quoted HTML attribute. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function meta(name: string, content: string): string {
  return `<meta name="${attr(name)}" content="${attr(content)}" />`;
}

function property(name: string, content: string): string {
  return `<meta property="${attr(name)}" content="${attr(content)}" />`;
}

/**
 * The whole `<head>` for one prerendered page, as a string.
 *
 * A string rather than React elements because this is assembled by the build script into a shell
 * that Vite has already written the hashed asset tags into. Nothing here is rendered at runtime.
 */
export function renderHead(input: HeadInput): string {
  const canonical = absoluteUrl(input.path);
  const ogImage = absoluteUrl('/og.png');

  const tags = [
    `<title>${attr(input.title)}</title>`,
    meta('description', input.description),
    `<link rel="canonical" href="${attr(canonical)}" />`,

    input.noindex
      ? meta('robots', 'noindex, follow')
      : meta('robots', 'index, follow, max-image-preview:large'),

    property('og:type', input.ogType),
    property('og:url', canonical),
    property('og:title', input.title),
    property('og:description', input.description),
    property('og:site_name', SITE_NAME),
    property('og:locale', 'en'),
    property('og:image', ogImage),
    property('og:image:width', '1200'),
    property('og:image:height', '630'),
    property('og:image:alt', 'PDF to EPUB, cover intact.'),

    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', input.title),
    meta('twitter:description', input.description),
    meta('twitter:image', ogImage),

    /*
     * The stylesheet already ships a `prefers-color-scheme` dark theme but declared neither of
     * these, so browser UI stayed light against a dark page. Two `theme-color` tags with media
     * queries is the supported way to give each scheme its own value.
     */
    meta('color-scheme', 'light dark'),
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f6f3" />`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#191918" />`,

    /*
     * Base-relative, not root-relative. The previous hardcoded `/favicon.svg` 404s under the
     * GitHub Pages project sub-path, which is the one asset URL that never got made base-aware.
     */
    `<link rel="icon" type="image/svg+xml" href="${attr(`${input.base}favicon.svg`)}" />`,
    `<link rel="manifest" href="${attr(`${input.base}manifest.webmanifest`)}" />`,
  ];

  if (input.analytics) {
    tags.push(`<script defer src="/_vercel/insights/script.js"></script>`);
  }

  return tags.map((tag) => `    ${tag}`).join('\n');
}
