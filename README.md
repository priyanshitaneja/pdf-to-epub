# pdf-to-epub

Converts a PDF into a Kindle-ready EPUB, entirely in the browser. No server, no uploads, and
the file never leaves your machine.

## Why this exists

Free online PDF→EPUB converters reliably strip the cover art. The cause is concrete: Kindle
locates an EPUB cover through the legacy EPUB2 declaration `<meta name="cover" content="ID"/>`
in the OPF `<metadata>` block. Many converters emit only the modern EPUB3
`properties="cover-image"` manifest attribute, or neither, so Amazon's Send-to-Kindle
pipeline has nothing to read and the book lands in the library as a grey placeholder.

This tool emits **both** declarations, plus a `cover.xhtml` first in the spine and an OPF
`<guide>` reference, and then validates its own output before letting you download it.

## Stack

Vite + React + TypeScript (strict) + Tailwind v4. `pdfjs-dist` for reading, `jszip` for
packaging. Four runtime dependencies, no others.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest
npm run lint       # oxlint
npm run build      # sync assets, tsc -b, client build, SSR build, prerender
npm run assets:og  # regenerate public/og.png from scripts/assets/og.svg (macOS only)
```

## Architecture

Two halves that meet at exactly one file, `src/types/document.ts`:

- **`src/extract/`** reads a PDF and produces a `DocModel`.
- **`src/epub/`** consumes a `DocModel` and produces a validated `.epub`. It must never
  import pdf.js; if it needs to, the contract is wrong and should be widened instead.

Because the seam is a plain data structure, the EPUB writer is developed and tested against
a hand-written fixture (`src/epub/__fixtures__/sampleDoc.ts`) with no PDF parsing involved.

`DocModel` and the EPUB writer support more block kinds than extraction currently produces
(tables, figures, code, quotes). Those paths are real and tested from fixtures; nothing
emits them yet.

### Static content and the converter island

The page around the converter is **rendered at build time**, not in the browser. GPTBot,
ClaudeBot, PerplexityBot and Bytespider do not execute JavaScript, so a client-rendered page
is invisible to them; before this, a crawler received a 473-byte document whose body was an
empty `<div>`.

- `src/content/` holds the copy as data, and is the single source of truth for the page, the
  structured data and `llms.txt`.
- `src/marketing/` holds hook-free presentational components. They are **never shipped to the
  client**, so there is no hydration step and no mismatch to worry about.
- `src/seo/` builds the `<head>` and the JSON-LD.
- `src/entry-prerender.tsx` is compiled to an SSR bundle and drives both paths:
  `scripts/prerender.mjs` at build time, and a `transformIndexHtml` hook in `vite.config.ts`
  during dev, so the two cannot drift.
- `src/main.tsx` mounts only `<Converter />`, into a `#converter-root` slot the prerendered
  page provides. Pages with nothing interactive on them ship no JavaScript at all.

`scripts/prerender.mjs` also generates `robots.txt`, `sitemap.xml`, `llms.txt`,
`manifest.webmanifest` and a real `404.html`, all derived from `VITE_SITE_URL` so nothing
hardcodes the origin.

## Fidelity

Honest about what it does and does not do.

Works well:

- **Untagged text PDFs** get heuristic structure from glyph geometry: lines rebuilt from glyph
  positions, words inferred from spacing, paragraphs joined across lines, headings detected by
  font size and weight, and running headers and footers dropped. Headings, paragraphs and
  lists come out; those are the three block kinds extraction emits.
- **Chapters** are split from heading structure, with both a nav document and an NCX index, so
  the Kindle menu jumps to chapters rather than page numbers.

Not implemented yet:

- **Tagged PDFs.** Reading the producer's own structure tree (Tier A) would be more accurate
  than guessing. The join key exists in `src/extract/types.ts`; nothing calls `getStructTree`.
- **Scanned PDFs.** There is no OCR. A PDF with no text layer produces an empty book.
  `DEFAULT_CONVERT_OPTIONS.ocr` defaults to true and the UI still renders an OCR progress row,
  which is misleading and should be gated until the tier lands.
- **Embedded images.** `DocModel.assets` is never populated, so figures do not carry across
  and `stats.figures` is hardcoded to `0`.

Every conversion is validated before download, against roughly forty structural checks. If a
problem would break the book on a Kindle, the download is blocked rather than handing over a
file that fails silently. Silent lossy conversion is the thing this tool is designed not to do.

## Deployment

Two origins serve the same build:

- **Vercel** at `https://pdf-to-epub-blue.vercel.app` is canonical. Base is `/`.
- **GitHub Pages** is a mirror, built with `VITE_BASE=/pdf-to-epub/`. Mirror builds emit
  `noindex` and point their canonical at the Vercel origin, so the two do not compete in
  search.
