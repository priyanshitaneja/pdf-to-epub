import { useCallback, useRef, useState } from 'react';
import type { CoverCandidate } from '../../types/document.ts';
import { useConverterState } from '../../hooks/useConverterState.ts';
import { runConversion } from '../../conversion/runConversion.ts';
import { FileDropzone } from './FileDropzone.tsx';
import { StageProgress } from './StageProgress.tsx';
import { CoverPanel } from './CoverPanel.tsx';
import { MetadataPanel } from './MetadataPanel.tsx';
import { ValidationReport } from './ValidationReport.tsx';
import { DownloadButton } from './DownloadButton.tsx';

export function Converter() {
  const {
    state,
    selectFile,
    setMeta,
    startConvert,
    reportProgress,
    succeed,
    fail,
    reset,
  } = useConverterState();

  const [cover, setCover] = useState<CoverCandidate | null>(null);
  // The document model is large and non-reactive, so it lives in a ref rather than state.
  // Keeping it lets metadata edits rebuild the EPUB without re-reading the PDF.
  const lastCover = useRef<CoverCandidate | null>(null);

  const convert = useCallback(async () => {
    if (!state.file) return;
    startConvert();
    try {
      const result = await runConversion({
        file: state.file,
        options: state.options,
        meta: state.editedMeta,
        coverOverride: lastCover.current,
        sink: (event) => {
          if (event.kind === 'progress') {
            reportProgress(event.stage, event.percent, event.detail);
          } else if (event.kind === 'cover') {
            const candidate = event.candidates[0];
            if (candidate) {
              setCover(candidate);
              lastCover.current = candidate;
            }
          }
        },
      });
      succeed(result);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  }, [state.file, state.options, state.editedMeta, startConvert, reportProgress, succeed, fail]);

  const blockedByValidation = state.result !== null && !state.result.validation.ok;

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        file={state.file}
        disabled={state.step === 'converting'}
        onSelect={selectFile}
        onReject={fail}
      />

      {(state.step === 'ready' || state.step === 'done' || state.step === 'error') &&
        state.file && (
          <button
            type="button"
            onClick={convert}
            className="bg-accent hover:bg-accent-hover rounded-xl px-5 py-3 font-medium text-white transition-colors"
          >
            {state.step === 'done' ? 'Convert again' : 'Convert'}
          </button>
        )}

      {state.step === 'converting' && state.progress && (
        <StageProgress
          stage={state.progress.stage}
          percent={state.progress.percent}
          detail={state.progress.detail}
          showOcr={state.options.ocr}
        />
      )}

      {state.step === 'error' && state.error && (
        <div className="border-danger/30 bg-danger/5 text-danger flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm">
          <span>{state.error}</span>
          <button type="button" onClick={reset} className="shrink-0 underline">
            Start over
          </button>
        </div>
      )}

      {state.step === 'done' && state.result && (
        <div className="border-border bg-surface-raised flex flex-col gap-5 rounded-xl border p-5">
          {cover && <CoverPanel cover={cover} />}

          <MetadataPanel
            meta={state.editedMeta}
            titleGuessed={state.pdfMeta?.titleSource !== 'info' && state.pdfMeta?.titleSource !== 'xmp'}
            onChange={setMeta}
          />

          <ValidationReport validation={state.result.validation} />

          <DownloadButton
            blob={state.result.blob}
            filename={state.result.filename}
            blocked={blockedByValidation}
            rebuilding={state.rebuilding}
          />

          <p className="text-text-secondary text-xs">
            Metadata edits apply on the next Convert. Send the downloaded file to your Kindle
            with Send to Kindle.
          </p>
        </div>
      )}
    </div>
  );
}
