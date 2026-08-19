import { useCallback, useRef, useState } from 'react';
import type { CoverCandidate, DocModel } from '../../types/document.ts';
import { useConverterState } from '../../hooks/useConverterState.ts';
import { runConversion } from '../../conversion/runConversion.ts';
import { rebuildEpub } from '../../conversion/rebuildEpub.ts';
import { coverFromFile } from '../../epub/cover/userCover.ts';
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
    setFilename,
    setCover,
    setRebuilding,
    startConvert,
    reportProgress,
    applyPdfMeta,
    succeed,
    fail,
    reset,
  } = useConverterState();

  /** The cover embedded in the EPUB as it currently stands, for display. */
  const [coverPreview, setCoverPreview] = useState<CoverCandidate | null>(null);
  /** A rejected upload. Kept out of `state.error`, which would tear down the whole result card. */
  const [coverError, setCoverError] = useState<string | null>(null);

  /*
   * The document model is large and non-reactive, so it lives in a ref rather than state. Keeping
   * it lets a cover swap rebuild the EPUB without re-reading the PDF.
   */
  const model = useRef<DocModel | null>(null);
  /** The cover the pipeline last chose, so re-converting does not re-render page one. */
  const lastCover = useRef<CoverCandidate | null>(null);

  /*
   * Refs sit outside the state object, so `selectFile`'s reset to INITIAL does not clear them.
   * Without this, choosing a second PDF would keep the first one's cover and model.
   */
  const chooseFile = useCallback(
    (file: File) => {
      model.current = null;
      lastCover.current = null;
      setCoverPreview(null);
      setCoverError(null);
      selectFile(file);
    },
    [selectFile],
  );

  const startOver = useCallback(() => {
    model.current = null;
    lastCover.current = null;
    setCoverPreview(null);
    setCoverError(null);
    reset();
  }, [reset]);

  const convert = useCallback(async () => {
    if (!state.file) return;
    startConvert();
    try {
      const result = await runConversion({
        file: state.file,
        options: state.options,
        meta: state.editedMeta,
        coverOverride: state.coverOverride ?? lastCover.current,
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
              setCoverPreview(candidate);
              lastCover.current = candidate;
            }
          } else if (event.kind === 'result') {
            // Retained so a later cover swap can rebuild without touching the PDF again.
            model.current = event.doc;
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
    state.coverOverride,
    startConvert,
    reportProgress,
    applyPdfMeta,
    succeed,
    fail,
  ]);

  const uploadCover = useCallback(
    async (file: File) => {
      setCoverError(null);

      let candidate: CoverCandidate;
      try {
        candidate = await coverFromFile(file);
      } catch (err) {
        setCoverError(err instanceof Error ? err.message : String(err));
        return;
      }

      // Held in state so it survives a re-convert, and shown immediately for feedback.
      setCover(candidate);
      lastCover.current = candidate;
      setCoverPreview(candidate);

      // Before the first conversion there is nothing to rebuild; it applies on Convert instead.
      if (!model.current) return;

      setRebuilding(true);
      try {
        succeed(
          await rebuildEpub({
            model: model.current,
            cover: candidate,
            meta: state.editedMeta,
          }),
        );
      } catch (err) {
        // Inline rather than `fail`, so a bad rebuild does not discard a working result.
        setRebuilding(false);
        setCoverError(err instanceof Error ? err.message : String(err));
      }
    },
    [setCover, setRebuilding, succeed, state.editedMeta],
  );

  const blockedByValidation = state.result !== null && !state.result.validation.ok;
  // `filenameOverride` holds the stem alone, so the extension stays ours to control.
  const downloadName =
    state.filenameOverride !== null
      ? `${state.filenameOverride}.epub`
      : (state.result?.filename ?? '');

  return (
    <div className="flex flex-col gap-6">
      <div className="enter flex flex-col gap-2" style={{ '--index': 1 } as React.CSSProperties}>
        <FileDropzone
          file={state.file}
          disabled={state.step === 'converting'}
          onSelect={chooseFile}
          onReject={fail}
        />
        {/* Stated once, and here rather than in the header: this is the moment you hand over a file. */}
        <p className="text-ink-muted text-xs">
          Converted in this tab. Your file is never uploaded.
        </p>
      </div>

      {(state.step === 'ready' || state.step === 'done' || state.step === 'error') && state.file && (
        <div className="enter" style={{ '--index': 2 } as React.CSSProperties}>
          <Button onClick={convert} wide>
            {state.step === 'done' ? 'Convert again' : 'Convert'}
          </Button>
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
            <button type="button" onClick={startOver} className="text-pale-red-ink self-start text-xs underline">
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
            {coverPreview && (
              <CoverPanel
                cover={coverPreview}
                busy={state.rebuilding}
                error={coverError}
                onUpload={uploadCover}
              />
            )}

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
                  filename={downloadName}
                  blocked={blockedByValidation}
                  rebuilding={state.rebuilding}
                  onFilenameChange={setFilename}
                />
                <p className="text-ink-muted max-w-[52ch] text-xs">
                  Title and author changes apply on the next Convert. A new cover applies straight
                  away. Send the downloaded file to your Kindle with Send to Kindle.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
