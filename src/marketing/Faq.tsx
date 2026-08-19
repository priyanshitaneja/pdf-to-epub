import { FAQ } from '../content/faq.ts';
import { Section } from './Section.tsx';

/**
 * Every answer visible, with no accordion.
 *
 * Collapsed content is indexed, but plain visible prose is what gets extracted cleanly when a
 * question is answered from the page rather than linked to, and it keeps the page free of the only
 * JavaScript it would otherwise need.
 */
export function Faq({ index }: { index: number }) {
  return (
    <Section id="faq" heading="Questions" index={index}>
      <dl className="flex flex-col gap-6">
        {FAQ.map((item) => (
          <div key={item.q} className="flex flex-col gap-1.5">
            <dt className="text-ink text-base">{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
