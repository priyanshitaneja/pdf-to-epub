import { useRef, useState } from 'react';

export interface FileDropzoneProps {
  file: File | null;
  disabled?: boolean;
  onSelect(file: File): void;
  onReject(message: string): void;
}

const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Drag-and-drop plus click-to-browse, for a single PDF.
 *
 * Built as a `<label>` around a visually hidden file input, so clicking and keyboard
 * activation both work without any custom key handling.
 */
export function FileDropzone({ file, disabled, onSelect, onReject }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child element, so depth has to be counted rather
  // than treated as a boolean.
  const dragDepth = useRef(0);

  function accept(candidate: File | undefined): void {
    if (!candidate) return;
    // Windows often reports an empty MIME type, so the extension is a legitimate fallback.
    const looksPdf =
      candidate.type === 'application/pdf' || /\.pdf$/i.test(candidate.name);
    if (!looksPdf) {
      onReject(`"${candidate.name}" is not a PDF.`);
      return;
    }
    if (candidate.size > MAX_BYTES) {
      onReject(
        `"${candidate.name}" is ${(candidate.size / 1024 / 1024).toFixed(0)} MB. The limit is 200 MB.`,
      );
      return;
    }
    onSelect(candidate);
  }

  return (
    <label
      className={[
        'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragging ? 'border-accent bg-accent/5' : 'border-border bg-surface-raised',
        disabled ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        accept(e.dataTransfer.files[0]);
      }}
    >
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          // Reset so selecting the same file twice still fires a change event.
          e.target.value = '';
        }}
      />
      {file ? (
        <>
          <span className="font-medium">{file.name}</span>
          <span className="text-text-secondary text-sm">
            {(file.size / 1024 / 1024).toFixed(1)} MB · click to choose a different file
          </span>
        </>
      ) : (
        <>
          <span className="font-medium">Drop a PDF here</span>
          <span className="text-text-secondary text-sm">or click to browse</span>
        </>
      )}
    </label>
  );
}
