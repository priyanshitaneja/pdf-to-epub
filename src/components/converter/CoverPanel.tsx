import type { CoverCandidate } from '../../types/document.ts';
import { isReasonableCoverRatio } from '../../epub/cover/coverDims.ts';
import { useObjectUrl } from '../../hooks/useObjectUrl.ts';

export interface CoverPanelProps {
  cover: CoverCandidate;
}

const PROVENANCE: Record<CoverCandidate['source'], string> = {
  'embedded-xobject': 'Extracted from the PDF at original quality',
  'rendered-page': 'Rendered from a page',
  synthesized: 'Generated from the title',
  'user-upload': 'Your uploaded image',
};

/**
 * The cover that will be embedded, shown before the download.
 *
 * Given more visual weight than anything else on the screen, deliberately. The complaint that
 * started this project was that other converters silently drop the cover, so this thumbnail is
 * the moment the tool proves itself — it gets the reveal animation and the largest single element
 * in the result panel.
 */
export function CoverPanel({ cover }: CoverPanelProps) {
  const url = useObjectUrl(cover.blob);
  const oddRatio = !isReasonableCoverRatio(cover.w, cover.h);

  return (
    <section className="flex gap-6">
      <div className="reveal border-line bg-surface-sunken w-[132px] shrink-0 overflow-hidden rounded-md border shadow-[var(--shadow-lift)]">
        {url ? (
          <img src={url} alt="Cover of the converted book" className="block h-auto w-full" />
        ) : (
          <div className="aspect-[1/1.6] w-full" />
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <h2 className="font-serif text-2xl tracking-[-0.02em]">Cover</h2>
        <p className="text-ink-soft text-sm">{PROVENANCE[cover.source]}</p>
        <p className="text-ink-muted font-mono text-xs">
          {cover.w} × {cover.h}
          {cover.lossless ? ' · original quality' : ''}
        </p>
        {oddRatio && (
          <p className="bg-pale-yellow text-pale-yellow-ink mt-1 rounded px-2 py-1 text-xs">
            Unusual proportions for a book cover. It will still display, just not fill the screen.
          </p>
        )}
      </div>
    </section>
  );
}
