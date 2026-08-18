/**
 * The message protocol between the main thread and the extraction worker.
 *
 * The UI hook speaks this from day one — including in M1, where the "worker" is a mock
 * that replays a canned event sequence. That way moving real work into a real worker later
 * touches no components.
 */

import type { CoverCandidate, DocMeta, DocModel, Tier, Warning } from './document.ts';

export type Stage =
  | 'loading'
  | 'probing'
  | 'structure'
  | 'text'
  | 'images'
  | 'ocr'
  | 'assembling'
  | 'packaging';

export interface ConvertOptions {
  tables: boolean;
  images: boolean;
  ocr: boolean;
  /** 0-based, inclusive page ranges. Empty means the whole document. */
  pageRanges: Array<{ from: number; to: number }>;
  fidelity: 'fast' | 'max';
  coverLongEdgePx: number;
}

export const DEFAULT_CONVERT_OPTIONS: ConvertOptions = {
  tables: true,
  images: true,
  ocr: true,
  pageRanges: [],
  fidelity: 'max',
  coverLongEdgePx: 1600,
};

export type WorkerRequest =
  | { kind: 'probe'; jobId: string; file: ArrayBuffer; fileName: string }
  | { kind: 'convert'; jobId: string; file: ArrayBuffer; fileName: string; options: ConvertOptions }
  | { kind: 'cancel'; jobId: string };

export type WorkerEvent =
  | { kind: 'probed'; jobId: string; pageCount: number; tierSample: Tier[]; meta: Partial<DocMeta> }
  | {
      kind: 'progress';
      jobId: string;
      stage: Stage;
      page: number;
      pageCount: number;
      /** 0-100, already weighted across stages. */
      percent: number;
      detail?: string;
    }
  | { kind: 'pageDone'; jobId: string; page: number; tier: Tier; warnings: Warning[] }
  | { kind: 'warning'; jobId: string; warning: Warning }
  | { kind: 'cover'; jobId: string; candidates: CoverCandidate[] }
  | { kind: 'result'; jobId: string; doc: DocModel }
  | { kind: 'error'; jobId: string; fatal: boolean; message: string; page?: number };

/**
 * Relative cost of one page at each stage, used to weight the progress bar.
 *
 * OCR is ~10x a text page. Without this weighting the bar sits at 40% for several minutes
 * on a scanned document and looks hung.
 */
export const STAGE_WEIGHTS: Record<Stage, number> = {
  loading: 1,
  probing: 1,
  structure: 2,
  text: 3,
  images: 3,
  ocr: 30,
  assembling: 2,
  packaging: 2,
};

/**
 * Progress posts are coalesced to at most this many per second.
 *
 * Posting per text item floods the main thread and is a real source of jank — the message
 * queue itself becomes the bottleneck.
 */
export const MAX_PROGRESS_EVENTS_PER_SEC = 20;
