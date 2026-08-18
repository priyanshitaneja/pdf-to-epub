/**
 * XML/XHTML serialization primitives.
 *
 * EPUB content documents are XHTML, which means they are parsed by a *strict* XML parser,
 * not an HTML one. A single raw `&` from a PDF text layer is a fatal error rather than
 * something the reader silently recovers from, so everything that reaches the output goes
 * through here.
 */

/** Characters that must never appear literally in element content. */
export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** As `escapeXml`, plus the quote characters that would terminate an attribute value. */
export function escapeAttr(s: string): string {
  return escapeXml(s).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Strip characters that are illegal in XML 1.0 regardless of escaping.
 *
 * PDF text layers routinely contain stray control bytes, and the Unicode non-characters
 * U+FFFE/U+FFFF show up in badly-encoded CJK. None of these can be represented in XML at
 * all — not as a literal, not as a numeric reference — so they must be removed rather than
 * escaped. Tab, newline and carriage return are the three legal exceptions.
 */
export function sanitizeXmlText(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) {
      out += ch;
      continue;
    }
    // C0 and C1 controls.
    if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue;
    // Non-characters.
    if (cp === 0xfffe || cp === 0xffff) continue;
    // Surrogate halves that survived as lone code points.
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    out += ch;
  }
  return out;
}

/** Sanitize then escape, in that order. The usual entry point for text content. */
export function xmlText(s: string): string {
  return escapeXml(sanitizeXmlText(s));
}

/** Sanitize then attribute-escape. */
export function xmlAttr(s: string): string {
  return escapeAttr(sanitizeXmlText(s));
}

/**
 * `dcterms:modified` and friends require a UTC timestamp with **no** fractional seconds.
 * `Date.prototype.toISOString()` includes milliseconds and fails epubcheck, which is an
 * easy and very common mistake.
 */
export function epubTimestamp(d: Date = new Date()): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface XhtmlDocOptions {
  title: string;
  lang: string;
  /** Emitted inside `<head>` as a stylesheet link. Omit for the cover page. */
  stylesheetHref?: string;
  /** Emitted inside `<head>` as an inline `<style>`. Used by the cover page. */
  inlineStyle?: string;
  /** Extra attributes on `<body>`, already escaped. */
  bodyAttrs?: string;
  body: string;
}

/**
 * Wrap body markup in a complete, well-formed XHTML document.
 *
 * UTF-8 is declared twice on purpose — in the XML declaration and again as `<meta charset>`.
 * Some Kindle-generation pipelines read only one of the two.
 */
export function xhtmlDoc(opts: XhtmlDocOptions): string {
  const head = [
    '  <meta charset="utf-8"/>',
    `  <title>${xmlText(opts.title)}</title>`,
    opts.stylesheetHref
      ? `  <link rel="stylesheet" type="text/css" href="${xmlAttr(opts.stylesheetHref)}"/>`
      : null,
    opts.inlineStyle ? `  <style type="text/css">\n${opts.inlineStyle}\n  </style>` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const lang = xmlAttr(opts.lang);
  const bodyAttrs = opts.bodyAttrs ? ` ${opts.bodyAttrs}` : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head>
${head}
</head>
<body${bodyAttrs}>
${opts.body}
</body>
</html>
`;
}

/** Void elements must be self-closed in XHTML. */
export function voidTag(name: string, attrs: Record<string, string | undefined> = {}): string {
  return `<${name}${attrString(attrs)}/>`;
}

export function attrString(attrs: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    parts.push(` ${key}="${xmlAttr(String(value))}"`);
  }
  return parts.join('');
}
