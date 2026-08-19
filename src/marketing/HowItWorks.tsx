import { HOW_IT_WORKS } from '../content/home.ts';
import { Section } from './Section.tsx';

export function HowItWorks({ index }: { index: number }) {
  return (
    <Section id="how-it-works" heading="How it works" index={index}>
      <ol className="flex flex-col gap-5">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step.name} id={`step-${i + 1}`} className="flex gap-4">
            {/* The number is the only ornament in the design, and it carries real meaning. */}
            <span className="text-ink-muted shrink-0 font-mono text-sm tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-ink text-base">{step.name}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
