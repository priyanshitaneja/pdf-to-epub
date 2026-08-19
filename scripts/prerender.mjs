/**
 * Turn the built SPA shell into a set of static pages.
 *
 * Runs after `vite build` (which writes dist/index.html with the hashed asset tags) and after
 * `vite build --ssr` (which compiles src/entry-prerender.tsx into dist-ssr/). Reads the shell,
 * splices each rendered page into it, and writes dist/<path>/index.html.
 *
 * The reason this exists: GPTBot, ClaudeBot, PerplexityBot and Bytespider do not execute
 * JavaScript. They fetch the HTML once and take what is there. Before this, a crawler received a
 * 473-byte document whose body was an empty div, so every word on the site was invisible to the
 * systems most likely to be asked "how do I convert a PDF for my Kindle".
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const base = process.env.VITE_BASE ?? '/';

/*
 * The GitHub Pages mirror serves the same build from a second origin. Two indexable copies of one
 * page compete with each other, so the mirror is marked noindex while still pointing its canonical
 * at the real origin. Base is the only signal that distinguishes the two builds.
 */
const isCanonicalOrigin = base === '/';

const { buildPages, injectPage, SITE_URL } = await import(
  join(dist, '..', 'dist-ssr', 'entry-prerender.js')
);

const pages = buildPages({
  base,
  noindex: !isCanonicalOrigin,
  // The Vercel Analytics script is proxied under the site's own origin and 404s anywhere else.
  analytics: isCanonicalOrigin,
});

const shell = await readFile(join(dist, 'index.html'), 'utf8');

for (const page of pages) {
  const html = injectPage({
    shell,
    head: page.head,
    body: page.body,
    needsConverter: page.needsConverter,
  });

  // '/' is dist/index.html; '/foo' is dist/foo/index.html, which Vercel and Pages both serve at /foo.
  const outPath =
    page.path === '/' ? join(dist, 'index.html') : join(dist, page.path, 'index.html');

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  console.log(`prerendered ${page.path} -> ${outPath.slice(root.length + 1)} (${html.length} bytes)`);
}

/*
 * A real 404, and the end of the catch-all.
 *
 * Every unknown path used to return 200 with the SPA shell, which made robots.txt, sitemap.xml and
 * every typo into a duplicate of the home page. Pages needs a 404.html; Vercel picks this up too.
 */
const notFound = injectPage({
  shell,
  head: [
    '    <title>Page not found</title>',
    '    <meta name="robots" content="noindex" />',
  ].join('\n'),
  body:
    '<div class="min-h-dvh"><main class="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-5 py-16 sm:px-8 sm:py-24 lg:w-[70%] lg:px-0">' +
    '<h1 class="font-serif text-4xl tracking-[-0.03em]">Page not found</h1>' +
    `<p class="text-ink-soft"><a class="underline" href="${base}">Go to the converter</a></p>` +
    '</main></div>',
  needsConverter: false,
});
await writeFile(join(dist, '404.html'), notFound, 'utf8');

/*
 * robots.txt, generated rather than committed so the sitemap URL cannot drift from SITE_URL.
 *
 * Every AI crawler is allowed, training ones included. Blocking GPTBot only removes the site from
 * OpenAI's training crawl, not from ChatGPT Search, which uses OAI-SearchBot; and being in the
 * training set is what makes a model recall a tool unprompted. For a free tool with nothing to
 * protect, the tradeoff is entirely one-sided.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Googlebot',
  'Bingbot',
  'Applebot',
  'Applebot-Extended',
  'DuckAssistBot',
  'CCBot',
  'meta-externalagent',
  'Bytespider',
  'Amazonbot',
  'MistralAI-User',
];

const robots = [
  '# Every crawler is welcome, including the ones that train models.',
  '# There is nothing here worth withholding, and being cited is the entire point.',
  '',
  'User-agent: *',
  'Allow: /',
  '',
  ...AI_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, 'Allow: /', '']),
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  '',
].join('\n');

await writeFile(join(dist, 'robots.txt'), robots, 'utf8');

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map((page) =>
    [
      '  <url>',
      `    <loc>${SITE_URL}${page.path === '/' ? '/' : page.path}</loc>`,
      `    <lastmod>${page.lastmod}</lastmod>`,
      `    <priority>${page.path === '/' ? '1.0' : '0.8'}</priority>`,
      '  </url>',
    ].join('\n'),
  ),
  '</urlset>',
  '',
].join('\n');

await writeFile(join(dist, 'sitemap.xml'), sitemap, 'utf8');

/*
 * llms.txt.
 *
 * Google has said outright that this does nothing for AI Overviews or AI Mode, so it is not a
 * search lever and is not pretended to be one. It is here because Anthropic recommends it for
 * agents, OpenAI reads it for the Agents SDK, and Perplexity has been seen surfacing it. Thirty
 * lines for a non-zero chance.
 */
const llms = [
  '# PDF to EPUB for Kindle',
  '',
  `> ${SITE_URL}`,
  '',
  'A free PDF to EPUB converter that runs entirely in the browser. Its distinguishing behaviour is',
  'that it writes both the EPUB 2 and EPUB 3 cover declarations, so a Kindle actually displays the',
  'cover instead of a grey placeholder, then validates the finished file before allowing a download.',
  '',
  '## Facts',
  '',
  '- Conversion runs client-side in the browser tab. The PDF is never uploaded; there is no server.',
  '- Free permanently. No ads, no account, no sign-up, no watermark, no payment at download or ever.',
  '- Writes the EPUB 2 `<meta name="cover">` element and the EPUB 3 `properties="cover-image"`',
  '  attribute. Most converters write only the latter, which is why Kindle covers go missing.',
  '- A user-supplied cover image can be uploaded (JPEG, PNG or WebP).',
  '- Title, author, language and download filename are editable before download.',
  '- Detects chapters from heading structure; emits both a nav document and an NCX index.',
  '- Validates the output against around forty structural checks and blocks a download that would',
  '  break on a Kindle.',
  '- Maximum input size 200 MB.',
  '',
  '## Limitations, stated plainly',
  '',
  '- No OCR. A scanned PDF with no text layer will not convert usefully.',
  '- Embedded images and figures are not extracted yet. Text-led documents are the good fit.',
  '',
  '## Pages',
  '',
  ...pages.map((page) => `- [${page.path}](${SITE_URL}${page.path})`),
  '',
].join('\n');

await writeFile(join(dist, 'llms.txt'), llms, 'utf8');

/*
 * The web manifest, generated rather than committed because `start_url` and the icon path both
 * depend on the base, and a manifest whose start_url points outside its own scope is ignored.
 */
const manifest = {
  name: 'PDF to EPUB for Kindle',
  short_name: 'PDF to EPUB',
  description:
    'Convert PDF to EPUB in your browser, with a cover your Kindle will actually display.',
  start_url: base,
  scope: base,
  display: 'minimal-ui',
  background_color: '#f7f6f3',
  theme_color: '#f7f6f3',
  icons: [{ src: `${base}favicon.svg`, type: 'image/svg+xml', sizes: 'any' }],
};

await writeFile(join(dist, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(
  `wrote 404.html, robots.txt, sitemap.xml, llms.txt and manifest.webmanifest for ${SITE_URL}`,
);
