import type { Inline } from '../../types/document.ts';
import { attrString, voidTag, xmlText } from './xml.ts';

export interface InlineContext {
  /**
   * Resolves an internal link's target block id to an href relative to the current chapter
   * file, e.g. `ch003.xhtml#h-b9`. Returns `null` when the target could not be placed, in
   * which case the link degrades to a plain `<span>` rather than emitting a dangling href.
   */
  resolveInternal(targetBlockId: string): string | null;
  /** Maps an asset id to its href relative to the chapter file, e.g. `images/img-0001.png`. */
  assetHref(assetId: string): string | null;
}

const EXTERNAL_HREF = /^(https?:|mailto:)/i;

export function serializeInlines(inlines: Inline[], ctx: InlineContext): string {
  return inlines.map((inline) => serializeInline(inline, ctx)).join('');
}

function serializeInline(inline: Inline, ctx: InlineContext): string {
  switch (inline.t) {
    case 'text':
      return wrapStyles(xmlText(inline.s), inline);

    case 'br':
      return voidTag('br');

    case 'link':
      return serializeLink(inline, ctx);

    case 'img':
      return serializeInlineImage(inline, ctx);
  }
}

/**
 * Apply character styling as nested tags.
 *
 * Order is fixed (`strong` outermost, then `em`, then `code`, then `sup`/`sub`) so that
 * identical input always produces byte-identical output — which is what makes the golden
 * tests meaningful.
 */
function wrapStyles(escaped: string, inline: Extract<Inline, { t: 'text' }>): string {
  let out = escaped;
  if (inline.sup) out = `<sup>${out}</sup>`;
  if (inline.sub) out = `<sub>${out}</sub>`;
  if (inline.code) out = `<code>${out}</code>`;
  if (inline.i) out = `<em>${out}</em>`;
  if (inline.b) out = `<strong>${out}</strong>`;
  return out;
}

function serializeLink(inline: Extract<Inline, { t: 'link' }>, ctx: InlineContext): string {
  const children = serializeInlines(inline.children, ctx);

  if (inline.internal) {
    const target = inline.targetBlockId ? ctx.resolveInternal(inline.targetBlockId) : null;
    // A dangling internal href is an epubcheck error and a dead tap on the device, so an
    // unresolvable link becomes plain text instead.
    if (!target) return `<span>${children}</span>`;
    return `<a${attrString({ href: target })}>${children}</a>`;
  }

  // Anything that is not clearly a web or mail link is dropped to plain text: `javascript:`
  // and `data:` hrefs are both a security question and an epubcheck failure.
  if (!EXTERNAL_HREF.test(inline.href)) return `<span>${children}</span>`;
  return `<a${attrString({ href: inline.href })}>${children}</a>`;
}

/**
 * An inline image — in practice a snapshotted equation.
 *
 * Width is emitted in `em` and vertical alignment as a percentage of the image's own height,
 * so the snapshot scales with the reader's chosen font size and sits on the text baseline
 * instead of floating.
 */
function serializeInlineImage(
  inline: Extract<Inline, { t: 'img' }>,
  ctx: InlineContext,
): string {
  const href = ctx.assetHref(inline.assetId);
  if (!href) return '';

  const style: string[] = [];
  if (inline.widthEm !== undefined) style.push(`width:${round(inline.widthEm)}em`);
  if (inline.baselineRatio !== undefined) {
    style.push(`vertical-align:${round(-inline.baselineRatio * 100)}%`);
  }

  return voidTag('img', {
    src: href,
    alt: inline.alt,
    class: 'inline-math',
    style: style.length > 0 ? style.join(';') : undefined,
  });
}

function round(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}
