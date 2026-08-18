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
 * Shows the cover that will be embedded, before the download happens.
 *
 * This is the confirmation step that matters most: the complaint that prompted this tool was
 * that other converters silently drop the cover, so seeing it here is what makes the result
 * trustworthy.
 */
export function CoverPanel({ cover }: CoverPanelProps) {
  const url = useObjectUrl(cover.blob);
  const oddRatio = !isReasonableCoverRatio(cover.w, cover.h);

  return (
    <section className="flex gap-4">
      <div className="border-border bg-surface w-[120px] shrink-0 overflow-hidden rounded-lg border">
        {url ? (
          <img src={url} alt="Cover preview" className="block h-auto w-full" />
        ) : (
          <div className="aspect-[1/1.6] w-full" />
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Cover</span>
        <span className="text-text-secondary">
          {PROVENANCE[cover.source]} · {cover.w} × {cover.h}
          {cover.lossless ? ' · original quality' : ''}
        </span>
        {oddRatio && (
          <span className="text-warn">
            Unusual proportions for a book cover. It will still display, just not fill the
            screen.
          </span>
        )}
      </div>
    </section>
  );
}
