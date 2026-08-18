import type { CoverCandidate } from '../types/document.ts';
import type { ConvertOptions, WorkerEvent } from '../types/worker-protocol.ts';
import { buildEpub, type EpubBuildResult } from '../epub/buildEpub.ts';
import { synthesizeCover } from '../epub/cover/synthesizeCover.ts';
import { mockExtract } from './mockPipeline.ts';
import type { ConvertEventSink } from './types.ts';

export interface RunConversionInput {
  file: File;
  options: ConvertOptions;
  meta: { title: string; author: string; language: string };
  coverOverride: CoverCandidate | null;
  sink: ConvertEventSink;
}

/**
 * Drive one conversion: extract, resolve a cover, build, validate.
 *
 * The extraction step is currently `mockExtract`. Everything downstream of it is real, so the
 * EPUB this produces is a genuine, validated file — it just describes the fixture document
 * rather than the uploaded PDF.
 */
export async function runConversion(input: RunConversionInput): Promise<EpubBuildResult> {
  const { file, meta, sink } = input;

  const doc = await mockExtract(file, sink);

  const authors = meta.author
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  emit(sink, { kind: 'progress', jobId: 'mock', stage: 'packaging', page: 0, pageCount: doc.meta.sourcePageCount, percent: 90, detail: 'Choosing cover' });

  const cover =
    input.coverOverride ??
    (await synthesizeCover({ title: meta.title || doc.meta.title, authors }));
  emit(sink, { kind: 'cover', jobId: 'mock', candidates: [cover] });

  emit(sink, { kind: 'progress', jobId: 'mock', stage: 'packaging', page: 0, pageCount: doc.meta.sourcePageCount, percent: 95, detail: 'Packaging EPUB' });

  const result = await buildEpub(doc, {
    cover: { blob: cover.blob, mime: cover.mime, w: cover.w, h: cover.h },
    metaOverrides: { title: meta.title, authors, language: meta.language },
  });

  emit(sink, { kind: 'progress', jobId: 'mock', stage: 'packaging', page: 0, pageCount: doc.meta.sourcePageCount, percent: 100, detail: 'Validating' });
  return result;
}

function emit(sink: ConvertEventSink, event: WorkerEvent): void {
  sink(event);
}
