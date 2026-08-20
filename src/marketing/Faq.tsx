import { FAQ } from '../content/faq.ts';
import { IconChevron } from '../components/ui/icons.tsx';
import { Section } from './Section.tsx';

/**
 * Questions as accordions, built on native `<details>` and `<summary>`.
 *
 * Native rather than scripted for two reasons. It keeps the page free of the only JavaScript it
 * would otherwise need outside the converter, which matters because the guide pages ship none at
 * all. And it comes with keyboard operation, focus handling and screen-reader semantics already
 * correct, which a div with an onClick does not.
 *
 * Collapsing the answers costs nothing in findability: the text is present in the HTML either way,
 * so crawlers and answer engines read all twelve regardless of what is open on screen.
 */
export function Faq({ index }: { index: number }) {
  return (
    <Section id="faq" heading="Questions" index={index}>
      <div className="flex flex-col">
        {FAQ.map((item) => (
          <details
            key={item.q}
            className="group border-line border-b last:border-b-0"
          >
            {/*
              `list-none` plus the webkit pseudo-element removes the default disclosure triangle in
              every engine; without both, one of them still draws its own marker next to the icon.
            */}
            <summary className="text-ink flex cursor-pointer list-none items-start justify-between gap-4 py-3.5 text-base [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <IconChevron className="text-ink-muted mt-1 h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-90" />
            </summary>
            <p className="pb-4">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
