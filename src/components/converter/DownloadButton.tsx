import { useObjectUrl } from '../../hooks/useObjectUrl.ts';

export interface DownloadButtonProps {
  blob: Blob;
  filename: string;
  blocked: boolean;
  rebuilding: boolean;
}

/**
 * A real anchor with `download`, not a scripted click.
 *
 * That way middle-click, long-press on iOS, and "save link as" all behave normally. The
 * object URL's lifetime is tied to the Blob rather than to the click, because Safari cancels
 * a download whose URL is revoked mid-flight.
 */
export function DownloadButton({ blob, filename, blocked, rebuilding }: DownloadButtonProps) {
  const url = useObjectUrl(blob);

  if (blocked) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled
          className="bg-border text-text-secondary cursor-not-allowed rounded-xl px-5 py-3 font-medium"
        >
          Download EPUB
        </button>
        <span className="text-text-secondary text-xs">
          Validation found a problem — see the report above.
        </span>
      </div>
    );
  }

  return (
    <a
      href={url ?? undefined}
      download={filename}
      aria-disabled={url === null || rebuilding}
      className="bg-accent hover:bg-accent-hover rounded-xl px-5 py-3 text-center font-medium text-white transition-colors"
    >
      {rebuilding ? 'Updating…' : `Download ${filename}`}
    </a>
  );
}
