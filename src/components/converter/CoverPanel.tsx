import type { CoverCandidate } from '../../types/document.ts';
import { isReasonableCoverRatio } from '../../epub/cover/coverDims.ts';
import { useObjectUrl } from '../../hooks/useObjectUrl.ts';
import { CoverDropzone } from './CoverDropzone.tsx';

export interface CoverPanelProps {
  cover: CoverCandidate;
  /** True while a replacement is being applied, which disables the picker. */
  busy?: boolean;
  /** A rejected upload, shown here rather than replacing the whole result card. */
  error?: string | null;
  onUpload(file: File): void;
}

const PROVENANCE: Record<CoverCandidate['source'], string> = {
  'embedded-xobject': 'Extracted from the PDF at original quality',
  'rendered-page': 'Rendered from the first page',
  synthesized: 'Generated from the title',
  'user-upload': 'Your uploaded image',
};

/**
 * The cover that will be embedded, shown before the download.
 *
 * Given the most visual weight on the screen, deliberately. The complaint that started this
 * project was that other converters silently drop the cover, so this thumbnail is the moment the
 * tool proves itself. It gets its own reveal animation and, on wide screens, its own column at
 * something close to a real book's presence rather than a 120px chip.
 */
export function CoverPanel({ cover, busy = false, error, onUpload }: CoverPanelProps) {
  const url = useObjectUrl(cover.blob);
  const oddRatio = !isReasonableCoverRatio(cover.w, cover.h);

  return (
    <section className="flex flex-col gap-4">
      <div className="reveal border-line bg-surface-sunken w-full max-w-[280px] overflow-hidden rounded-md border shadow-[var(--shadow-lift)]">
        {url ? (
          <img src={url} alt="Cover of the converted book" className="block h-auto w-full" />
        ) : (
          <div className="aspect-[1/1.41] w-full" />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="font-serif text-2xl tracking-[-0.02em]">Cover</h2>
        <p className="text-ink-soft text-sm">{PROVENANCE[cover.source]}</p>
        <p className="text-ink-muted font-mono text-xs">
          {cover.w} × {cover.h}
          {cover.lossless ? ' · original quality' : ''}
        </p>
        {oddRatio && (
          <p className="bg-pale-yellow text-pale-yellow-ink mt-1 max-w-[280px] rounded px-2 py-1.5 text-xs">
            Unusual proportions for a book cover. It will still display, just not fill the screen.
          </p>
        )}
      </div>

      {/*
        Replacing the cover rebuilds the EPUB from the document already in memory, so it applies
        immediately rather than waiting for the next Convert. An off-ratio image is flagged above and
        never cropped: reframing artwork someone chose is not a converter's decision to make.
      */}
      <div className="flex flex-col gap-2">
        <CoverDropzone disabled={busy} onSelect={onUpload} />
        {error ? (
          <p className="bg-pale-red text-pale-red-ink max-w-[280px] rounded px-2 py-1.5 text-xs">
            {error}
          </p>
        ) : (
          <p className="text-ink-muted max-w-[280px] text-xs">
            JPEG, PNG or WebP. 1600 by 2560 is what Amazon recommends.
          </p>
        )}
      </div>
    </section>
  );
}
