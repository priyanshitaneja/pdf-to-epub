/** Sentinels in index.html, replaced with the rendered head and body. */
export const HEAD_SENTINEL = '<!--PRERENDER-HEAD-->';
export const BODY_SENTINEL = '<!--PRERENDER-BODY-->';

export interface InjectInput {
  /**
   * The HTML shell. During a build this is the `dist/index.html` Vite has already written its
   * hashed script and stylesheet tags into; during dev it is the raw template.
   */
  shell: string;
  head: string;
  body: string;
  /**
   * When false, the module script tag is removed so the page ships no JavaScript. The stylesheet
   * link is emitted separately by Vite and is left in place, which is why a guide page still comes
   * out styled.
   */
  needsConverter: boolean;
}

/**
 * Splice one rendered page into the shell.
 *
 * Lives here rather than in the build script so the dev server and the production build share it.
 * Two code paths producing almost-identical HTML is how a page ends up working in dev and shipping
 * broken.
 */
export function injectPage(input: InjectInput): string {
  let html = input.shell;

  if (!html.includes(HEAD_SENTINEL) || !html.includes(BODY_SENTINEL)) {
    throw new Error(
      `index.html is missing ${HEAD_SENTINEL} or ${BODY_SENTINEL}; the prerenderer has nowhere to write.`,
    );
  }

  html = html.replace(HEAD_SENTINEL, input.head.trimStart());
  html = html.replace(BODY_SENTINEL, input.body);

  if (!input.needsConverter) {
    html = html.replace(/[ \t]*<script type="module"[^>]*><\/script>\n?/g, '');
  }

  return html;
}
