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
 * A titled content section.
 *
 * Prose carries its own measure cap rather than filling the 70% container: at that width a
 * paragraph runs past 150 characters a line, which is where reading falls apart. The container is
 * sized for the interactive surfaces, so text has to constrain itself independently.
 */
export function Section({ id, heading, index, children }: SectionProps) {
  return (
    <section
      id={id}
      className="enter border-line flex flex-col gap-4 border-t pt-8"
      style={{ '--index': index } as CSSProperties}
    >
      <h2 className="font-serif text-3xl tracking-[-0.02em]">{heading}</h2>
      <div className="text-ink-soft flex max-w-[65ch] flex-col gap-4 text-base">{children}</div>
    </section>
  );
}
