import { useObjectUrl } from '../../hooks/useObjectUrl.ts';
import { IconDownload } from '../ui/icons.tsx';
import {
  FILENAME_STEM_MAX,
  sanitizeFilenameStem,
  stripIllegalFilenameChars,
} from '../../epub/filename.ts';

export interface DownloadButtonProps {
  blob: Blob;
  filename: string;
  blocked: boolean;
  rebuilding: boolean;
  /** Null restores the name derived from title and author. */
  onFilenameChange(name: string | null): void;
}

/**
 * A real anchor with `download`, not a scripted click.
 *
 * That way middle-click, long-press on iOS, and "save link as" all behave normally. The object
 * URL's lifetime is tied to the Blob rather than the click, because Safari cancels a download
 * whose URL is revoked mid-flight.
 */
export function DownloadButton({
  blob,
  filename,
  blocked,
  rebuilding,
  onFilenameChange,
}: DownloadButtonProps) {
  const url = useObjectUrl(blob);
  const stem = filename.replace(/\.epub$/i, '');

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
      {/*
        The name is editable here rather than as another labelled field, because this is where you
        look to find out what you are about to save. Illegal characters are dropped as you type;
        collapsing whitespace waits for blur, since doing it live makes a two-word name untypable.
        Emptying the field falls back to the name derived from title and author, and `.epub` is
        fixed so a renamed file cannot end up with an extension Kindle refuses.
      */}
      <div className="text-ink-muted flex items-baseline font-mono text-[11px]">
        <input
          value={stem}
          aria-label="Download filename"
          spellCheck={false}
          onChange={(e) =>
            onFilenameChange(stripIllegalFilenameChars(e.target.value).slice(0, FILENAME_STEM_MAX))
          }
          onBlur={(e) => {
            const settled = sanitizeFilenameStem(e.target.value);
            onFilenameChange(settled.length > 0 ? settled : null);
          }}
          className="hover:border-line focus:border-line-strong min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 outline-none"
        />
        <span className="shrink-0">.epub</span>
      </div>
    </div>
  );
}
