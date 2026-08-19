import { useRef, useState } from 'react';
import { USER_COVER_ACCEPT } from '../../epub/cover/userCover.ts';

export interface CoverDropzoneProps {
  disabled?: boolean;
  onSelect(file: File): void;
}

/**
 * A compact drop target for replacing the cover.
 *
 * Deliberately not `FileDropzone` with props added. That component is a hero empty state at
 * `px-6 py-14`, which is the wrong size sitting under a 280px thumbnail, and it is PDF-specific in
 * four places. What is worth copying is the mechanics: a `<label>` wrapping a visually hidden input
 * so click and keyboard activation both work with no key handling, the drag depth counted rather
 * than treated as a boolean, and the input value reset so the same file can be chosen twice.
 */
export function CoverDropzone({ disabled, onSelect }: CoverDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function accept(candidate: File | undefined): void {
    if (candidate) onSelect(candidate);
  }

  return (
    <label
      className={[
        'flex w-full max-w-[280px] cursor-pointer items-center justify-center rounded-md border border-dashed px-3 py-2.5 text-center text-xs',
        'transition-[border-color,background-color] duration-200',
        dragging
          ? 'border-line-strong bg-surface-sunken text-ink'
          : 'border-line-strong text-ink-soft hover:text-ink hover:bg-surface-sunken',
        disabled ? 'pointer-events-none opacity-50' : '',
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
        accept={USER_COVER_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {dragging ? 'Drop to use as the cover' : 'Use my own image'}
    </label>
  );
}
