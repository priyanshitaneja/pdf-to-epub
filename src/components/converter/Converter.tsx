import { useCallback, useRef, useState } from 'react';
import type { CoverCandidate } from '../../types/document.ts';
import { useConverterState } from '../../hooks/useConverterState.ts';
import { runConversion } from '../../conversion/runConversion.ts';
import { Button } from '../ui/Button.tsx';
import { IconAlert } from '../ui/icons.tsx';
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
    applyPdfMeta,
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
          } else if (event.kind === 'probed') {
            // Prefill title/author/language from the PDF, so the metadata panel is populated
            // before the user ever sees it.
            applyPdfMeta(event.meta);
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
  }, [
    state.file,
    state.options,
    state.editedMeta,
    startConvert,
    reportProgress,
    applyPdfMeta,
    succeed,
    fail,
  ]);

  const blockedByValidation = state.result !== null && !state.result.validation.ok;

  return (
    <div className="flex flex-col gap-6">
      <div className="enter flex flex-col gap-2" style={{ '--index': 1 } as React.CSSProperties}>
        <FileDropzone
          file={state.file}
          disabled={state.step === 'converting'}
          onSelect={selectFile}
          onReject={fail}
        />
        {/* Stated once, and here rather than in the header: this is the moment you hand over a file. */}
        <p className="text-ink-muted text-xs">
          Converted in this tab. Your file is never uploaded.
        </p>
      </div>

      {(state.step === 'ready' || state.step === 'done' || state.step === 'error') && state.file && (
        <div className="enter" style={{ '--index': 2 } as React.CSSProperties}>
          <Button onClick={convert}>{state.step === 'done' ? 'Convert again' : 'Convert'}</Button>
        </div>
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
        <div className="border-line bg-pale-red flex items-start gap-3 rounded-lg border p-4">
          <span className="text-pale-red-ink mt-0.5 shrink-0">
            <IconAlert className="h-4 w-4" />
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-pale-red-ink text-sm">{state.error}</p>
            <button type="button" onClick={reset} className="text-pale-red-ink self-start text-xs underline">
              Start over
            </button>
          </div>
        </div>
      )}

      {state.step === 'done' && state.result && (
        <div className="border-line bg-surface enter rounded-lg border p-6 sm:p-8">
          {/*
            Two columns from `lg`: the cover keeps its own column so it reads at close to a book's
            presence, and the editable details sit beside it rather than below a mostly-empty row.
          */}
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-12">
            {cover && <CoverPanel cover={cover} />}

            <div className="flex flex-col gap-7">
              <MetadataPanel
                meta={state.editedMeta}
                titleGuessed={
                  state.pdfMeta?.titleSource !== 'info' && state.pdfMeta?.titleSource !== 'xmp'
                }
                onChange={setMeta}
              />

              <ValidationReport validation={state.result.validation} />

              <div className="border-line flex flex-col gap-3 border-t pt-6">
                <DownloadButton
                  blob={state.result.blob}
                  filename={state.result.filename}
                  blocked={blockedByValidation}
                  rebuilding={state.rebuilding}
                />
                <p className="text-ink-muted max-w-[52ch] text-xs">
                  Edits to the details above apply on the next Convert. Send the downloaded file to
                  your Kindle with Send to Kindle.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
