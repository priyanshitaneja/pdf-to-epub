import { useObjectUrl } from '../../hooks/useObjectUrl.ts';
import { IconDownload } from '../ui/icons.tsx';

export interface DownloadButtonProps {
  blob: Blob;
  filename: string;
  blocked: boolean;
  rebuilding: boolean;
}

/**
 * A real anchor with `download`, not a scripted click.
 *
 * That way middle-click, long-press on iOS, and "save link as" all behave normally. The object
 * URL's lifetime is tied to the Blob rather than the click, because Safari cancels a download
 * whose URL is revoked mid-flight.
 */
export function DownloadButton({ blob, filename, blocked, rebuilding }: DownloadButtonProps) {
  const url = useObjectUrl(blob);

  if (blocked) {
    return (
      <div className="flex flex-col gap-2">
        <span className="border-line text-ink-muted inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-dashed px-5 py-3 text-sm">
          <IconDownload className="h-4 w-4" />
          Download blocked
        </span>
        <span className="text-pale-red-ink text-xs">
          Validation found a problem that would break the book on your Kindle. See the report above.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={url ?? undefined}
        download={filename}
        aria-disabled={url === null || rebuilding}
        className="bg-action text-canvas hover:bg-action-hover inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm transition-[background-color,transform] duration-200 active:scale-[0.98]"
      >
        <IconDownload className="h-4 w-4" />
        {rebuilding ? 'Updating' : 'Download EPUB'}
      </a>
      <span className="text-ink-muted font-mono text-[11px] break-all">{filename}</span>
    </div>
  );
}
