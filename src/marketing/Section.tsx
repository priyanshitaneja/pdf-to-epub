import type { CSSProperties, ReactNode } from 'react';

export interface SectionProps {
  /** Anchor target, so structured data and in-page links can point at a step or section. */
  id?: string;
  heading: string;
  /** Position in the staggered entry sequence. The converter occupies 0 through 2. */
  index: number;
  children: ReactNode;
}

/**
 * A titled content section, heading beside the prose rather than above it.
 *
 * Prose has to carry its own measure cap: at the full width of the 70% container a paragraph runs
 * past 150 characters a line, which is where reading falls apart. But a capped measure inside a
 * wide container leaves the whole right side empty, with the heading and the rule spanning a width
 * the text never reaches, which reads as a bug rather than as typography.
 *
 * Moving the heading into its own column absorbs that slack with structure instead of stretching
 * the lines. It is the same two-column arrangement the result card already uses for the cover and
 * the details, so the page reads as one design. The heading is `text-2xl` to match the h2s there,
 * and because a larger serif wraps badly in a 15rem column.
 */
export function Section({ id, heading, index, children }: SectionProps) {
  return (
    <section
      id={id}
      className="enter border-line border-t pt-8"
      style={{ '--index': index } as CSSProperties}
    >
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12">
        <h2 className="font-serif text-2xl tracking-[-0.02em]">{heading}</h2>
        <div className="text-ink-soft flex max-w-[68ch] flex-col gap-4 text-base">{children}</div>
      </div>
    </section>
  );
}
