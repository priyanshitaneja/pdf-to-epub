import type { DocModel } from '../types/document.ts';
import type { ConvertEventSink } from './types.ts';
import { sampleDoc } from '../epub/__fixtures__/sampleDoc.ts';

/**
 * Stand-in for the real extraction worker.
 *
 * It emits the same `WorkerEvent` sequence the worker will, so the UI is written against the
 * final protocol from the start and swapping in real parsing later touches no components.
 * Milestone M1-X replaces this module; nothing above it changes.
 */
export async function mockExtract(file: File, sink: ConvertEventSink): Promise<DocModel> {
  const stages = [
    { stage: 'loading' as const, detail: 'Reading file' },
    { stage: 'probing' as const, detail: 'Detecting document type' },
    { stage: 'structure' as const, detail: 'Reading structure tree' },
    { stage: 'text' as const, detail: 'Extracting text' },
    { stage: 'images' as const, detail: 'Extracting images' },
    { stage: 'assembling' as const, detail: 'Assembling document' },
  ];

  const doc = sampleDoc();
  doc.meta.sourceFileName = file.name;

  for (const [index, s] of stages.entries()) {
    const percent = Math.round(((index + 1) / (stages.length + 1)) * 85);
    sink({
      kind: 'progress',
      jobId: 'mock',
      stage: s.stage,
      page: 0,
      pageCount: doc.meta.sourcePageCount,
      percent,
      detail: s.detail,
    });
    await delay(220);
  }

  sink({
    kind: 'probed',
    jobId: 'mock',
    pageCount: doc.meta.sourcePageCount,
    tierSample: ['A'],
    meta: doc.meta,
  });
  return doc;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
