/**
 * Types shared between the prerender entry and the Vite config.
 *
 * A plain `.ts` module on purpose: `vite.config.ts` is compiled under `tsconfig.node.json`, which
 * does not enable JSX, so it cannot import a type out of `entry-prerender.tsx`.
 */
export interface PrerenderEnv {
  /** Resolved Vite base, always ending in a slash. */
  base: string;
  /** True for the GitHub Pages mirror, which must not compete with the canonical origin. */
  noindex: boolean;
  /** True only where the Vercel Analytics endpoint exists. */
  analytics: boolean;
}

export interface RenderedPage {
  /** Route path. '/' becomes dist/index.html, '/foo' becomes dist/foo/index.html. */
  path: string;
  /** Indented head tags, including JSON-LD, ready to splice into the shell. */
  head: string;
  /** Static markup for the body. */
  body: string;
  /**
   * False for pages with nothing interactive on them, which then ship no JavaScript at all. The
   * converter bundle carries pdf.js, so keeping it off the guides is most of why they are fast.
   */
  needsConverter: boolean;
  /** ISO date for the sitemap. */
  lastmod: string;
}
