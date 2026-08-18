/**
 * The stylesheet shipped inside every generated EPUB.
 *
 * Constrained by what Kindle's renderer actually honours. The rules below are deliberate:
 *
 * - **Relative font sizes only.** A `px` font size defeats the reader's size control, which
 *   is the main reason for converting a PDF in the first place.
 * - **No flex, grid, float or absolute positioning.** Older Kindle firmware ignores or
 *   mishandles all of them, and a layout that silently collapses is worse than a simple one.
 * - **Tables at 0.72em with `table-layout: fixed`.** A 6" screen cannot fit a wide table at
 *   body size; fixed layout plus `word-wrap` keeps columns from overflowing off-screen.
 * - **`page-break-before: always` on h1 only.** Chapter starts get a fresh page; deeper
 *   headings do not, or a document with many h2s becomes mostly whitespace.
 *
 * `EPUB_BANNED_CSS` below is asserted against this string in the test suite, so the
 * constraints cannot rot as the stylesheet is edited.
 */
export const STYLE_CSS = `@charset "utf-8";

body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.5;
  margin: 0.5em 1em;
  text-align: left;
  widows: 2;
  orphans: 2;
}

h1, h2, h3, h4, h5, h6 {
  font-family: Helvetica, Arial, sans-serif;
  line-height: 1.25;
  page-break-after: avoid;
  break-after: avoid;
  -webkit-hyphens: none;
  hyphens: none;
}

h1 {
  font-size: 1.6em;
  margin: 0 0 0.6em;
  page-break-before: always;
  break-before: page;
}
h2 { font-size: 1.35em; margin: 1.4em 0 0.4em; }
h3 { font-size: 1.15em; margin: 1.2em 0 0.3em; }
h4, h5, h6 { font-size: 1em; margin: 1.1em 0 0.3em; }

p { margin: 0 0 0.6em; text-indent: 0; }

.align-center { text-align: center; }
.align-right { text-align: right; }
.align-justify { text-align: justify; }

ul, ol { margin: 0.6em 0 0.6em 1.4em; padding: 0; }
li { margin: 0 0 0.3em; }

blockquote {
  margin: 0.7em 1em;
  padding: 0 0 0 0.8em;
  border-left: 3px solid #999999;
  font-style: italic;
}

pre {
  font-family: monospace;
  font-size: 0.8em;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0.6em 0;
}
code { font-family: monospace; font-size: 0.85em; }

pre.table-fallback {
  font-size: 0.72em;
  border: 1px solid #cccccc;
  padding: 0.4em;
}

img { max-width: 100%; height: auto; }
img.inline-math { max-width: 100%; }

figure {
  margin: 0.8em 0;
  text-align: center;
  page-break-inside: avoid;
}
figcaption { font-size: 0.85em; font-style: italic; }

table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.72em;
  font-family: Helvetica, Arial, sans-serif;
  margin: 0.7em 0 1.1em;
  table-layout: fixed;
}
caption {
  font-size: 0.8em;
  font-style: italic;
  text-align: left;
  margin: 0 0 0.3em;
}
th {
  background: #eeeeee;
  text-align: left;
  padding: 0.35em 0.4em;
  border: 1px solid #bbbbbb;
  font-size: 0.95em;
}
td {
  padding: 0.35em 0.4em;
  border: 1px solid #cccccc;
  vertical-align: top;
  word-wrap: break-word;
}

hr { border: 0; border-top: 1px solid #cccccc; margin: 1.4em 0; }

.source-page { display: none; }

nav ol { list-style-type: none; margin-left: 1em; }
`;

/**
 * Properties that must never appear in the generated stylesheet.
 *
 * Each one either defeats reflow (fixed font sizes), or is unsupported on Kindle firmware
 * in a way that silently collapses the layout rather than degrading.
 */
export const EPUB_BANNED_CSS: readonly string[] = [
  'position:fixed',
  'position:absolute',
  'float:',
  '@font-face',
  'display:flex',
  'display:grid',
  '!important',
  'vw',
  'vh',
];
