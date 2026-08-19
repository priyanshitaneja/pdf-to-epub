import { COSTS } from '../content/home.ts';
import { IconCheck } from '../components/ui/icons.tsx';
import { Section } from './Section.tsx';

/**
 * Written as a list of things that do not happen.
 *
 * "Free" on its own is what every converter with a paid tier also says, so it carries no
 * information. Specific absences are checkable, and a reader can tell the difference.
 */
export function Costs({ index }: { index: number }) {
  return (
    <Section id="what-it-costs" heading="What this costs: nothing" index={index}>
      <ul className="flex flex-col gap-2.5">
        {COSTS.map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="text-pale-green-ink mt-0.5 shrink-0">
              <IconCheck className="h-4 w-4" />
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="text-ink-muted text-sm">
        The reason this is credible rather than a promise: the conversion runs on your computer, in
        your browser. There is no server doing the work, so there is no bill that has to be paid by
        advertising, by a subscription, or by holding your file until you enter a card.
      </p>
    </Section>
  );
}
