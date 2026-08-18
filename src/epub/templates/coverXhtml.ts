import { xhtmlDoc, xmlAttr } from '../serialize/xml.ts';

export interface CoverXhtmlInput {
  lang: string;
  imageHref: string;
  /** Intrinsic pixel dimensions of the cover image. Required for a correct SVG viewBox. */
  widthPx: number;
  heightPx: number;
  alt: string;
  markup: 'svg' | 'img';
}

/**
 * Build `cover.xhtml`.
 *
 * Two things worth being precise about, because they are independent and both matter:
 *
 * 1. Whether the cover *exists* in the Kindle library is decided by the OPF
 *    `<meta name="cover">` line, not by this file.
 * 2. Whether the cover *looks* right on page one is decided here.
 *
 * The default is the SVG-wrapped `<image>` pattern that Calibre emits, because it is
 * genuinely full-bleed and letterboxes correctly at any screen aspect. The plain `<img>`
 * alternative inherits `body { margin: 0.5em 1em }` from the shared stylesheet and renders
 * with visible white gutters. The SVG pattern's one failure mode is a wrong viewBox, and we
 * cannot hit it: the image is produced here, so its intrinsic pixel size is always known.
 *
 * Either way this page must NOT link the shared stylesheet — its own margin:0 is inlined.
 */
export function coverXhtml(input: CoverXhtmlInput): string {
  const body =
    input.markup === 'svg'
      ? svgBody(input)
      : `  <div class="cover"><img src="${xmlAttr(input.imageHref)}" alt="${xmlAttr(input.alt)}"/></div>`;

  const inlineStyle =
    input.markup === 'svg'
      ? '    html, body { margin: 0; padding: 0; height: 100%; background: #ffffff; text-align: center; }'
      : [
          '    html, body { margin: 0; padding: 0; height: 100%; background: #ffffff; text-align: center; }',
          '    .cover { margin: 0; padding: 0; }',
          '    .cover img { max-width: 100%; height: auto; }',
        ].join('\n');

  return xhtmlDoc({
    title: 'Cover',
    lang: input.lang,
    inlineStyle,
    bodyAttrs: 'epub:type="cover"',
    body,
  });
}

function svgBody(input: CoverXhtmlInput): string {
  const alt = xmlAttr(input.alt);
  return `  <div style="height: 100%; margin: 0; padding: 0;">
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 ${input.widthPx} ${input.heightPx}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${alt}">
      <title>${alt}</title>
      <image width="${input.widthPx}" height="${input.heightPx}" xlink:href="${xmlAttr(input.imageHref)}"/>
    </svg>
  </div>`;
}
