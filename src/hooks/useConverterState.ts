import { useCallback, useState } from 'react';
import type { CoverCandidate, DocMeta } from '../types/document.ts';
import type { ConvertOptions, Stage } from '../types/worker-protocol.ts';
import { DEFAULT_CONVERT_OPTIONS } from '../types/worker-protocol.ts';
import type { EpubBuildResult } from '../epub/buildEpub.ts';

export type ConverterStep = 'idle' | 'ready' | 'converting' | 'done' | 'error';

export interface EditableMeta {
  title: string;
  author: string;
  language: string;
}

export interface ConverterState {
  step: ConverterStep;
  file: File | null;
  pdfMeta: Partial<DocMeta> | null;
  editedMeta: EditableMeta;
  options: ConvertOptions;
  coverOverride: CoverCandidate | null;
  progress: { stage: Stage; percent: number; detail?: string } | null;
  result: EpubBuildResult | null;
  /** True while metadata or cover edits are being re-applied without re-parsing the PDF. */
  rebuilding: boolean;
  error: string | null;
}

const INITIAL: ConverterState = {
  step: 'idle',
  file: null,
  pdfMeta: null,
  editedMeta: { title: '', author: '', language: 'en' },
  options: DEFAULT_CONVERT_OPTIONS,
  coverOverride: null,
  progress: null,
  result: null,
  rebuilding: false,
  error: null,
};

/**
 * One state object with `useCallback` transitions, following the `useWizardState` pattern
 * from the sibling color-analysis project.
 */
export function useConverterState() {
  const [state, setState] = useState<ConverterState>(INITIAL);

  const selectFile = useCallback((file: File) => {
    setState({
      ...INITIAL,
      step: 'ready',
      file,
      editedMeta: { title: stemOf(file.name), author: '', language: 'en' },
    });
  }, []);

  const setMeta = useCallback((patch: Partial<EditableMeta>) => {
    setState((s) => ({ ...s, editedMeta: { ...s.editedMeta, ...patch } }));
  }, []);

  const setOptions = useCallback((patch: Partial<ConvertOptions>) => {
    setState((s) => ({ ...s, options: { ...s.options, ...patch } }));
  }, []);

  const setCover = useCallback((cover: CoverCandidate | null) => {
    setState((s) => ({ ...s, coverOverride: cover }));
  }, []);

  const startConvert = useCallback(() => {
    setState((s) => ({ ...s, step: 'converting', progress: null, error: null, result: null }));
  }, []);

  const reportProgress = useCallback((stage: Stage, percent: number, detail?: string) => {
    setState((s) => ({ ...s, progress: { stage, percent, detail } }));
  }, []);

  const applyPdfMeta = useCallback((meta: Partial<DocMeta>) => {
    setState((s) => ({
      ...s,
      pdfMeta: meta,
      editedMeta: {
        title: meta.title?.trim() || s.editedMeta.title,
        author: meta.authors?.join(', ') ?? s.editedMeta.author,
        language: meta.language ?? s.editedMeta.language,
      },
    }));
  }, []);

  const succeed = useCallback((result: EpubBuildResult) => {
    setState((s) => ({ ...s, step: 'done', result, rebuilding: false, progress: null }));
  }, []);

  const fail = useCallback((message: string) => {
    setState((s) => ({ ...s, step: 'error', error: message, rebuilding: false, progress: null }));
  }, []);

  const setRebuilding = useCallback((rebuilding: boolean) => {
    setState((s) => ({ ...s, rebuilding }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return {
    state,
    selectFile,
    setMeta,
    setOptions,
    setCover,
    startConvert,
    reportProgress,
    applyPdfMeta,
    succeed,
    fail,
    setRebuilding,
    reset,
  };
}

function stemOf(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
}
