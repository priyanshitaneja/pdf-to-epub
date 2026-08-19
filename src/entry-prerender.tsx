/* oxlint-disable react/only-export-components */
/*
 * The rule above does not apply here: this module is never part of the client bundle and is never
 * hot-reloaded. It is compiled to an SSR bundle and called by the build script and by the dev
 * server's transformIndexHtml hook, so mixing components with the functions that render them is
 * the point of the file.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import type { PrerenderEnv, RenderedPage } from './seo/pages.ts';
import { Layout } from './marketing/Layout.tsx';
import { HomePage } from './marketing/HomePage.tsx';
import { GuidePage } from './marketing/GuidePage.tsx';
import { GUIDES } from './content/guides.ts';
import { HOME_DESCRIPTION } from './content/home.ts';
import { SITE_URL } from './content/site.ts';
import { renderHead } from './seo/head.ts';
import type { JsonLd } from './seo/jsonld.ts';
import {
  articleLd,
  breadcrumbLd,
  faqPageLd,
  howToLd,
  renderJsonLd,
  webApplicationLd,
  webSiteLd,
} from './seo/jsonld.ts';


/**
 * Re-exported so both consumers reach them through this one SSR bundle: the dev server via
 * `ssrLoadModule`, and the build script via the compiled output. Neither has to duplicate the
 * environment fallback or the injection rules.
 */
export { SITE_URL };
export { injectPage } from './seo/shell.ts';
export type { PrerenderEnv, RenderedPage } from './seo/pages.ts';

const HOME_TITLE = 'Free PDF to EPUB Converter for Kindle, Cover Intact';

/**
 * Render every page to markup.
 *
 * Called by scripts/prerender.mjs after `vite build`, through a separate SSR bundle. Nothing in
 * here may touch a browser API: these components are deliberately hook-free and are never shipped
 * to the client, which is also why there is no hydration step and no mismatch to worry about.
 */
export function buildPages(env: PrerenderEnv): RenderedPage[] {
  const buildDate = new Date().toISOString().slice(0, 10);

  const head = (input: {
    path: string;
    title: string;
    description: string;
    ogType: 'website' | 'article';
    jsonLd: JsonLd[];
  }): string =>
    [
      renderHead({
        path: input.path,
        title: input.title,
        description: input.description,
        ogType: input.ogType,
        base: env.base,
        noindex: env.noindex,
        analytics: env.analytics,
      }),
      renderJsonLd(input.jsonLd),
    ].join('\n');

  const pages: RenderedPage[] = [
    {
      path: '/',
      head: head({
        path: '/',
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        ogType: 'website',
        jsonLd: [webSiteLd(), webApplicationLd(), howToLd(), faqPageLd()],
      }),
      body: renderToStaticMarkup(
        <Layout>
          <HomePage base={env.base} />
        </Layout>,
      ),
      needsConverter: true,
      lastmod: buildDate,
    },
  ];

  for (const guide of GUIDES) {
    pages.push({
      path: guide.path,
      head: head({
        path: guide.path,
        title: guide.title,
        description: guide.description,
        ogType: 'article',
        jsonLd: [
          articleLd({
            path: guide.path,
            title: guide.title,
            description: guide.description,
            datePublished: guide.datePublished,
          }),
          breadcrumbLd([
            { name: 'PDF to EPUB', path: '/' },
            { name: guide.h1, path: guide.path },
          ]),
        ],
      }),
      body: renderToStaticMarkup(
        <Layout>
          <GuidePage guide={guide} base={env.base} />
        </Layout>,
      ),
      needsConverter: false,
      lastmod: guide.datePublished,
    });
  }

  return pages;
}
