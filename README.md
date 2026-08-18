# pdf-to-epub

Converts a PDF into a Kindle-ready EPUB, entirely in the browser. No server, no uploads —
the file never leaves your machine.

## Why this exists

Free online PDF→EPUB converters reliably strip the cover art. The cause is concrete: Kindle
locates an EPUB cover through the legacy EPUB2 declaration `<meta name="cover" content="ID"/>`
in the OPF `<metadata>` block. Many converters emit only the modern EPUB3
`properties="cover-image"` manifest attribute — or neither — so Amazon's Send-to-Kindle
pipeline has nothing to read and the book lands in the library as a grey placeholder.

This tool emits **both** declarations, plus a `cover.xhtml` first in the spine and an OPF
`<guide>` reference, and then validates its own output before letting you download it.

## Stack

Vite + React + TypeScript (strict) + Tailwind v4. `pdfjs-dist` for reading, `jszip` for
packaging, `tesseract.js` for OCR of scanned documents.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest
npm run build      # tsc -b && vite build
```

## Architecture

Two halves that meet at exactly one file, `src/types/document.ts`:

- **`src/extract/`** reads a PDF and produces a `DocModel`. It picks a strategy per page —
  tagged structure tree (Tier A), geometric heuristics (Tier B), or OCR (Tier C).
- **`src/epub/`** consumes a `DocModel` and produces a validated `.epub`. It must never
  import pdf.js; if it needs to, the contract is wrong and should be widened instead.

Because the seam is a plain data structure, the EPUB writer is developed and tested against
a hand-written fixture (`src/epub/__fixtures__/sampleDoc.ts`) with no PDF parsing involved.

## Fidelity

Honest about what it does well:

- **Tagged PDFs** (anything printed from Chrome, exported from Word, or LaTeX with
  `tagpdf`) come out near-perfect — real headings, real lists, real tables — because the
  producer's own semantics are read rather than guessed.
- **Untagged text PDFs** get heuristic structure. Headings and paragraphs are usually right;
  multi-column and table reconstruction are best-effort.
- **Scanned PDFs** are OCR'd into reflowable text, which trades some accuracy for a book you
  can actually resize the font on.

Every table that fell back to a plain block, every low-confidence OCR page, and every
unresolved link is counted and shown in the conversion report. Silent lossy conversion is
the thing this tool is designed not to do.
