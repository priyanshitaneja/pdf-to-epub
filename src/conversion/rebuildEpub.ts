import type { CoverCandidate, DocModel } from '../types/document.ts';
import { buildEpub, type EpubBuildResult } from '../epub/buildEpub.ts';

export interface RebuildEpubInput {
  model: DocModel;
  cover: CoverCandidate;
  meta: { title: string; author: string; language: string };
}

/**
 * Rebuild the EPUB from an already-extracted document.
 *
 * Swapping a cover or fixing a title does not need the PDF again, and re-reading a 400-page
 * document to change one image is the difference between instant and half a minute. No separate
 * validation call: `buildEpub` runs the validator itself and returns the report.
 *
 * Deliberately its own module rather than part of `runConversion`. That file imports pdf.js at the
 * top level, and nothing here needs it, so living alongside it would make a rebuild drag a PDF
 * parser in and make this untestable outside a browser.
 *
 * This cannot serve a cover that comes from the PDF, such as rendering a different page, because
 * the pdf.js document is released when the conversion finishes. A user-supplied image needs no
 * such access, which is what makes the upload path cheap.
 */
export async function rebuildEpub(input: RebuildEpubInput): Promise<EpubBuildResult> {
  const { title, authors } = resolveMeta(input.meta, input.model);

  return buildEpub(input.model, {
    cover: {
      blob: input.cover.blob,
      mime: input.cover.mime,
      w: input.cover.w,
      h: input.cover.h,
    },
    metaOverrides: { title, authors, language: input.meta.language },
  });
}

/** The user's edits win over anything read from the PDF. Shared with the full conversion path. */
export function resolveMeta(
  meta: { title: string; author: string },
  model: DocModel,
): { title: string; authors: string[] } {
  const authors = meta.author
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  return { title: meta.title.trim() || model.meta.title, authors };
}
