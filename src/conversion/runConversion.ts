import type { CoverCandidate } from '../types/document.ts';
import type { ConvertOptions, WorkerEvent } from '../types/worker-protocol.ts';
import { buildEpub, type EpubBuildResult } from '../epub/buildEpub.ts';
import { synthesizeCover } from '../epub/cover/synthesizeCover.ts';
import { selectCover } from '../epub/cover/renderPageCover.ts';
import { describeLoadError, loadPdf } from '../pdf/loadDocument.ts';
import { extractDocument } from '../extract/extractDocument.ts';
import type { ConvertEventSink } from './types.ts';

export interface RunConversionInput {
  file: File;
  options: ConvertOptions;
  meta: { title: string; author: string; language: string };
  coverOverride: CoverCandidate | null;
  sink: ConvertEventSink;
  isCancelled?: () => boolean;
}

/**
 * Drive one conversion end to end: read the PDF, extract it, resolve a cover, build, validate.
 *
 * Runs on the main thread for now. Everything it calls already reports progress through the
 * worker event protocol, so moving it into a worker is a mechanical change that does not touch
 * the UI.
 */
export async function runConversion(input: RunConversionInput): Promise<EpubBuildResult> {
  const { file, meta, sink, options } = input;

  emit(sink, { kind: 'progress', jobId: JOB, stage: 'loading', page: 0, pageCount: 0, percent: 2, detail: 'Reading file' });
  const buffer = await file.arrayBuffer();

  let loaded;
  try {
    loaded = await loadPdf(buffer);
  } catch (err) {
    throw new Error(describeLoadError(err));
  }

  try {
    const { doc } = loaded;
    const pageCount = doc.numPages;

    emit(sink, {
      kind: 'probed',
      jobId: JOB,
      pageCount,
      tierSample: [],
      meta: { sourcePageCount: pageCount, sourceFileName: file.name },
    });

    // Extraction is the bulk of the work, so it owns most of the progress range.
    const model = await extractDocument(doc, {
      fileName: file.name,
      isCancelled: input.isCancelled,
      onProgress: ({ page, pageCount: total, detail }) => {
        const fraction = total > 0 ? (page + 1) / total : 1;
        emit(sink, {
          kind: 'progress',
          jobId: JOB,
          stage: 'text',
          page,
          pageCount: total,
          percent: Math.round(5 + fraction * 75),
          detail,
        });
      },
    });

    // Re-announce metadata now that extraction has resolved a real title and page tiers.
    emit(sink, {
      kind: 'probed',
      jobId: JOB,
      pageCount,
      tierSample: model.report.tierByPage,
      meta: model.meta,
    });

    // The user's edits win over anything read from the PDF.
    const authors = meta.author
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const title = meta.title.trim() || model.meta.title;

    emit(sink, { kind: 'progress', jobId: JOB, stage: 'images', page: 0, pageCount, percent: 84, detail: 'Choosing a cover' });

    const cover =
      input.coverOverride ??
      (await selectCover(doc, options.coverLongEdgePx)) ??
      (await synthesizeCover({ title, authors }));
    emit(sink, { kind: 'cover', jobId: JOB, candidates: [cover] });

    emit(sink, { kind: 'progress', jobId: JOB, stage: 'packaging', page: 0, pageCount, percent: 92, detail: 'Packaging EPUB' });

    const result = await buildEpub(model, {
      cover: { blob: cover.blob, mime: cover.mime, w: cover.w, h: cover.h },
      metaOverrides: { title, authors, language: meta.language },
    });

    emit(sink, { kind: 'progress', jobId: JOB, stage: 'packaging', page: 0, pageCount, percent: 100, detail: 'Validating' });

    for (const warning of model.report.warnings) {
      emit(sink, { kind: 'warning', jobId: JOB, warning });
    }

    return result;
  } finally {
    // Always release the worker, including when extraction threw.
    await loaded.destroy();
  }
}

const JOB = 'main';

function emit(sink: ConvertEventSink, event: WorkerEvent): void {
  sink(event);
}
