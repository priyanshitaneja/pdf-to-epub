import JSZip from 'jszip';
import { checkMimetypeBytes } from './byteChecks.ts';
import { probeImage } from './imageProbe.ts';
import { summarize, type ValidationIssue, type ValidationResult } from './types.ts';

/** Advisory ceiling per XHTML file; above this Kindle's converter slows noticeably. */
const MAX_XHTML_BYTES = 300_000;
/** Advisory ceiling for the whole book. */
const MAX_EPUB_BYTES = 50 * 1024 * 1024;

/** Below this on either edge, Kindle declines to build a library thumbnail at all. */
const MIN_COVER_EDGE = 100;
/** Kindle/KDP's recommended long edge. Smaller still works, but looks soft in the grid. */
const RECOMMENDED_COVER_LONG_EDGE = 1000;

/**
 * Validate a generated EPUB by re-opening it, so the writer's own output is checked rather
 * than its intentions. Runs before the Download button unlocks.
 *
 * Errors block the download (with an explicit override); warnings are advisory. The cover
 * checks are all errors, because a missing cover is the exact failure this tool exists to
 * prevent.
 */
export async function validateEpub(blob: Blob): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  issues.push(...(await checkMimetypeBytes(blob)));

  if (blob.size > MAX_EPUB_BYTES) {
    issues.push({
      severity: 'warning',
      code: 'epub-large',
      message: `EPUB is ${(blob.size / 1024 / 1024).toFixed(1)} MB. Send to Kindle accepts it, but conversion will be slow.`,
    });
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(blob);
  } catch (err) {
    issues.push({
      severity: 'error',
      code: 'zip-unreadable',
      message: `Archive could not be reopened: ${err instanceof Error ? err.message : String(err)}`,
    });
    return summarize(issues);
  }

  const paths = new Set(Object.keys(zip.files).filter((p) => !zip.files[p]!.dir));

  // --- container.xml -> OPF -------------------------------------------------
  const containerText = await readText(zip, 'META-INF/container.xml');
  if (containerText === null) {
    issues.push({
      severity: 'error',
      code: 'container-missing',
      message: 'META-INF/container.xml is missing.',
    });
    return summarize(issues);
  }

  const containerDoc = parseXml(containerText);
  if (typeof containerDoc === 'string') {
    issues.push({
      severity: 'error',
      code: 'container-malformed',
      message: `META-INF/container.xml is not well-formed: ${containerDoc}`,
    });
    return summarize(issues);
  }

  const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') ?? null;
  if (opfPath === null) {
    issues.push({
      severity: 'error',
      code: 'rootfile-missing',
      message: 'container.xml declares no rootfile full-path.',
    });
    return summarize(issues);
  }
  if (!paths.has(opfPath)) {
    issues.push({
      severity: 'error',
      code: 'rootfile-unresolved',
      message: `container.xml points at "${opfPath}", which is not in the archive.`,
      path: opfPath,
    });
    return summarize(issues);
  }

  const opfText = (await readText(zip, opfPath))!;
  const opfDoc = parseXml(opfText);
  if (typeof opfDoc === 'string') {
    issues.push({
      severity: 'error',
      code: 'opf-malformed',
      message: `${opfPath} is not well-formed: ${opfDoc}`,
      path: opfPath,
    });
    return summarize(issues);
  }

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const resolve = (href: string) => normalizePath(opfDir + decodeURIComponent(href.split('#')[0]!));

  // --- manifest / spine ----------------------------------------------------
  const items = Array.from(opfDoc.querySelectorAll('manifest > item'));
  const byId = new Map<string, Element>();
  const manifestPaths = new Set<string>();

  for (const item of items) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (!id || !href) {
      issues.push({
        severity: 'error',
        code: 'manifest-item-incomplete',
        message: 'A manifest item is missing its id or href.',
      });
      continue;
    }
    byId.set(id, item);
    const resolved = resolve(href);
    manifestPaths.add(resolved);
    if (!paths.has(resolved)) {
      issues.push({
        severity: 'error',
        code: 'manifest-href-unresolved',
        message: `Manifest item "${id}" points at "${href}", which is not in the archive.`,
        path: resolved,
      });
    }
  }

  const spineRefs = Array.from(opfDoc.querySelectorAll('spine > itemref'));
  if (spineRefs.length === 0) {
    issues.push({ severity: 'error', code: 'spine-empty', message: 'The spine has no itemrefs.' });
  }
  spineRefs.forEach((ref, index) => {
    const idref = ref.getAttribute('idref');
    if (!idref) {
      issues.push({ severity: 'error', code: 'spine-idref-missing', message: `Spine entry ${index} has no idref.` });
      return;
    }
    const item = byId.get(idref);
    if (!item) {
      issues.push({
        severity: 'error',
        code: 'spine-idref-unresolved',
        message: `Spine references "${idref}", which is not in the manifest.`,
      });
      return;
    }
    const mediaType = item.getAttribute('media-type');
    if (mediaType !== 'application/xhtml+xml') {
      issues.push({
        severity: 'error',
        code: 'spine-media-type',
        message: `Spine item "${idref}" has media-type "${mediaType}"; spine items must be application/xhtml+xml.`,
      });
    }
  });

  const navItems = items.filter((i) => (i.getAttribute('properties') ?? '').split(/\s+/).includes('nav'));
  if (navItems.length !== 1) {
    issues.push({
      severity: 'error',
      code: 'nav-count',
      message: `Exactly one manifest item must declare properties="nav", found ${navItems.length}.`,
    });
  }

  const spineToc = opfDoc.querySelector('spine')?.getAttribute('toc') ?? null;
  if (spineToc === null) {
    issues.push({
      severity: 'warning',
      code: 'ncx-not-referenced',
      message: 'The spine has no toc attribute, so Kindle will not find the NCX.',
    });
  } else if (!byId.has(spineToc)) {
    issues.push({
      severity: 'error',
      code: 'ncx-unresolved',
      message: `spine toc="${spineToc}" does not match any manifest item.`,
    });
  }

  for (const path of paths) {
    if (path === 'mimetype' || path.startsWith('META-INF/') || path === opfPath) continue;
    if (!manifestPaths.has(path)) {
      issues.push({
        severity: 'warning',
        code: 'orphan-file',
        message: `"${path}" is in the archive but not declared in the manifest.`,
        path,
      });
    }
  }

  // --- cover: the headline checks -----------------------------------------
  issues.push(...(await checkCover(zip, opfDoc, byId, resolve, spineRefs)));

  // --- metadata ------------------------------------------------------------
  const modified = textOf(opfDoc, 'metadata > meta[property="dcterms:modified"]');
  if (modified === null) {
    issues.push({ severity: 'error', code: 'dcterms-modified-missing', message: 'dcterms:modified is missing.' });
  } else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(modified)) {
    issues.push({
      severity: 'error',
      code: 'dcterms-modified-format',
      message: `dcterms:modified must be YYYY-MM-DDTHH:MM:SSZ with no milliseconds, got "${modified}".`,
    });
  }

  const identifier = textOf(opfDoc, 'metadata > identifier') ?? textOf(opfDoc, 'metadata > dc\\:identifier');
  if (identifier === null || !/^urn:uuid:[0-9a-fA-F-]{36}$/.test(identifier)) {
    issues.push({
      severity: 'error',
      code: 'identifier-format',
      message: `dc:identifier should be a urn:uuid, got ${identifier === null ? 'nothing' : `"${identifier}"`}.`,
    });
  }

  for (const [name, selector] of [
    ['dc:title', 'metadata > title'],
    ['dc:language', 'metadata > language'],
  ] as const) {
    const value = textOf(opfDoc, selector);
    if (value === null || value.trim().length === 0) {
      issues.push({ severity: 'error', code: 'metadata-missing', message: `${name} is missing or empty.` });
    }
  }

  const creator = textOf(opfDoc, 'metadata > creator');
  if (creator === null || creator.trim().length === 0 || creator === 'Unknown') {
    issues.push({
      severity: 'warning',
      code: 'creator-unknown',
      message: 'No author is set, so the Kindle library will show "Unknown".',
    });
  }

  // --- content documents ---------------------------------------------------
  issues.push(...(await checkContentDocuments(zip, items, resolve, paths)));

  return summarize(issues);
}

async function checkCover(
  zip: JSZip,
  opfDoc: Document,
  byId: Map<string, Element>,
  resolve: (href: string) => string,
  spineRefs: Element[],
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // The EPUB2 hook. Selecting on the unprefixed name matters: a namespaced
  // <opf:meta name="cover"> is exactly the mistake that breaks Kindle conversion.
  const metaCover = Array.from(opfDoc.querySelectorAll('metadata > meta')).find(
    (m) => m.getAttribute('name') === 'cover' && !m.nodeName.includes(':'),
  );

  if (!metaCover) {
    issues.push({
      severity: 'error',
      code: 'cover-meta-missing',
      message: 'No <meta name="cover"> in <metadata>. This is the declaration Kindle reads; without it the book shows a grey placeholder in the library.',
    });
    return issues;
  }

  const coverId = metaCover.getAttribute('content');
  if (!coverId) {
    issues.push({
      severity: 'error',
      code: 'cover-meta-empty',
      message: '<meta name="cover"> has no content attribute.',
    });
    return issues;
  }

  const coverItem = byId.get(coverId);
  if (!coverItem) {
    issues.push({
      severity: 'error',
      code: 'cover-meta-unresolved',
      message: `<meta name="cover" content="${coverId}"> does not match any manifest item id.`,
    });
    return issues;
  }

  const properties = (coverItem.getAttribute('properties') ?? '').split(/\s+/);
  if (!properties.includes('cover-image')) {
    issues.push({
      severity: 'error',
      code: 'cover-image-property-missing',
      message: `Manifest item "${coverId}" is the declared cover but lacks properties="cover-image".`,
    });
  }

  const href = coverItem.getAttribute('href');
  const declaredMime = coverItem.getAttribute('media-type');
  if (!href) {
    issues.push({ severity: 'error', code: 'cover-href-missing', message: 'The cover item has no href.' });
    return issues;
  }

  const coverPath = resolve(href);
  const entry = zip.file(coverPath);
  if (!entry) {
    issues.push({
      severity: 'error',
      code: 'cover-file-missing',
      message: `The cover image "${coverPath}" is declared but not present in the archive.`,
      path: coverPath,
    });
    return issues;
  }

  const bytes = await entry.async('uint8array');
  if (bytes.length === 0) {
    issues.push({
      severity: 'error',
      code: 'cover-file-empty',
      message: `The cover image "${coverPath}" is zero bytes.`,
      path: coverPath,
    });
  } else {
    // Parse the image header rather than trusting magic bytes. An 8-byte file containing only a
    // PNG signature satisfies a magic-byte check and shipped as a "valid" cover once, which
    // Kindle rendered as no cover at all.
    const probe = probeImage(bytes);
    if (probe === null) {
      issues.push({
        severity: 'error',
        code: 'cover-undecodable',
        message: `The cover image "${coverPath}" is ${bytes.length} bytes and has no readable image header. Kindle will show no cover.`,
        path: coverPath,
      });
    } else {
      if (probe.mime !== declaredMime) {
        // A media-type that disagrees with the bytes is a classic silent Kindle rejection.
        issues.push({
          severity: 'error',
          code: 'cover-mime-mismatch',
          message: `Cover is declared as "${declaredMime}" but its bytes are ${probe.mime}.`,
          path: coverPath,
        });
      }
      if (probe.width < MIN_COVER_EDGE || probe.height < MIN_COVER_EDGE) {
        issues.push({
          severity: 'error',
          code: 'cover-too-small',
          message: `The cover image is ${probe.width}x${probe.height}. Kindle needs at least ${MIN_COVER_EDGE}px on each edge to show a library thumbnail.`,
          path: coverPath,
        });
      } else if (Math.max(probe.width, probe.height) < RECOMMENDED_COVER_LONG_EDGE) {
        issues.push({
          severity: 'warning',
          code: 'cover-low-resolution',
          message: `The cover is ${probe.width}x${probe.height}; ${RECOMMENDED_COVER_LONG_EDGE}px on the long edge looks better in the Kindle library.`,
          path: coverPath,
        });
      }
    }
  }

  const firstSpineId = spineRefs[0]?.getAttribute('idref');
  const coverPageItem = firstSpineId ? byId.get(firstSpineId) : undefined;
  const coverPageHref = coverPageItem?.getAttribute('href') ?? '';
  if (!coverPageHref.includes('cover')) {
    issues.push({
      severity: 'error',
      code: 'cover-page-not-first',
      message: `The first spine item is "${coverPageHref || firstSpineId}", not the cover page.`,
    });
  } else {
    const pagePath = resolve(coverPageHref);
    const pageText = await readText(zip, pagePath);
    const imageFile = href.split('/').pop()!;
    if (pageText !== null && !pageText.includes(imageFile)) {
      issues.push({
        severity: 'error',
        code: 'cover-page-missing-image',
        message: `${pagePath} does not reference the cover image "${imageFile}".`,
        path: pagePath,
      });
    }
  }

  const guideCover = Array.from(opfDoc.querySelectorAll('guide > reference')).some(
    (r) => r.getAttribute('type') === 'cover',
  );
  if (!guideCover) {
    issues.push({
      severity: 'warning',
      code: 'guide-cover-missing',
      message: 'No <guide><reference type="cover">. Harmless on modern readers, but older Kindle firmware uses it.',
    });
  }

  return issues;
}

async function checkContentDocuments(
  zip: JSZip,
  items: Element[],
  resolve: (href: string) => string,
  paths: Set<string>,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const xhtmlItems = items.filter((i) => i.getAttribute('media-type') === 'application/xhtml+xml');
  /** All ids per document, so fragment targets can be checked. */
  const idsByPath = new Map<string, Set<string>>();
  const hrefsByPath = new Map<string, string[]>();

  for (const item of xhtmlItems) {
    const href = item.getAttribute('href');
    if (!href) continue;
    const path = resolve(href);
    const text = await readText(zip, path);
    if (text === null) continue;

    const parsed = parseXml(text);
    if (typeof parsed === 'string') {
      // The single most valuable check in the suite: this is what catches an unescaped `&`
      // from a PDF text layer before it reaches the device.
      issues.push({
        severity: 'error',
        code: 'xhtml-malformed',
        message: `${path} is not well-formed XHTML: ${parsed}`,
        path,
      });
      continue;
    }

    if (!/encoding="utf-8"/i.test(text)) {
      issues.push({
        severity: 'warning',
        code: 'xhtml-no-xml-encoding',
        message: `${path} does not declare encoding="utf-8" in its XML declaration.`,
        path,
      });
    }
    if (!parsed.querySelector('head > meta[charset]')) {
      issues.push({
        severity: 'warning',
        code: 'xhtml-no-meta-charset',
        message: `${path} has no <meta charset="utf-8"/>.`,
        path,
      });
    }

    const size = new TextEncoder().encode(text).length;
    if (size > MAX_XHTML_BYTES) {
      issues.push({
        severity: 'warning',
        code: 'xhtml-large',
        message: `${path} is ${Math.round(size / 1024)} KB; large content documents convert slowly on Kindle.`,
        path,
      });
    }

    idsByPath.set(path, new Set(Array.from(parsed.querySelectorAll('[id]')).map((el) => el.id)));
    hrefsByPath.set(
      path,
      Array.from(parsed.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')!),
    );
  }

  for (const [path, hrefs] of hrefsByPath) {
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    for (const href of hrefs) {
      if (/^(https?:|mailto:)/i.test(href)) continue;
      const [target, fragment] = splitFragment(href);
      const targetPath = target.length === 0 ? path : normalizePath(dir + decodeURIComponent(target));
      if (!paths.has(targetPath)) {
        issues.push({
          severity: 'error',
          code: 'internal-link-unresolved',
          message: `${path} links to "${href}", which is not in the archive.`,
          path,
        });
        continue;
      }
      if (fragment && !(idsByPath.get(targetPath)?.has(fragment) ?? false)) {
        issues.push({
          severity: 'warning',
          code: 'fragment-unresolved',
          message: `${path} links to "${href}", but no element with id "${fragment}" exists there.`,
          path,
        });
      }
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ helpers -- */

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async('string');
}

/** Returns the parsed document, or the parser's error message as a string. */
function parseXml(source: string): Document | string {
  const doc = new DOMParser().parseFromString(source, 'application/xhtml+xml');
  const err = doc.querySelector('parsererror');
  if (err) return (err.textContent ?? 'unknown parser error').trim().split('\n')[0]!;
  if (doc.documentElement.nodeName === 'parsererror') {
    return (doc.documentElement.textContent ?? 'unknown parser error').trim().split('\n')[0]!;
  }
  return doc;
}

function textOf(doc: Document, selector: string): string | null {
  const el = doc.querySelector(selector);
  return el?.textContent?.trim() ?? null;
}

function splitFragment(href: string): [string, string | null] {
  const hash = href.indexOf('#');
  if (hash === -1) return [href, null];
  return [href.slice(0, hash), href.slice(hash + 1) || null];
}

/** Collapse `a/b/../c` to `a/c` so archive lookups match. */
function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}
