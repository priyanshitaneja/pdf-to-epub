/**
 * Hand-written SVG primitives.
 *
 * The taste protocol bans emoji and generic thin-line icon packs, and asks for a slightly
 * thicker technical stroke. It suggests Phosphor or Radix; five glyphs is not worth a dependency
 * in an app that already ships pdf.js, so these are drawn to the same spec: 1.75 stroke, square
 * viewBox, `currentColor`, standardised across the set.
 */

interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </Svg>
  );
}

export function IconCross({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconAlert({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  );
}

export function IconInfo({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 11v5" />
      <path d="M12 7.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  );
}

export function IconDocument({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14 3v5h5" />
      <path d="M18 21H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8l5 5v11a1 1 0 0 1-1 1Z" />
    </Svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19h14" />
    </Svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}
