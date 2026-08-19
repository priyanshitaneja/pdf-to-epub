import type { CSSProperties } from 'react';
import { HERO_TAGLINE } from '../content/home.ts';

/**
 * The one `h1` on the page.
 *
 * Static rather than client-rendered: crawlers that do not execute JavaScript, which is most of the
 * ones that feed AI answers, previously saw an empty document body and nothing else.
 */
export function Hero() {
  return (
    <header className="enter flex flex-col gap-5" style={{ '--index': 0 } as CSSProperties}>
      <h1 className="font-serif text-5xl leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
        PDF to EPUB,
        <br />
        cover intact.
      </h1>
      {/*
        Measure-constrained independently of the container. A 70%-wide paragraph on a large
        display runs past 150 characters a line, which is where reading falls apart.
      */}
      <p className="text-ink-soft max-w-[60ch] text-base sm:text-lg">{HERO_TAGLINE}</p>
    </header>
  );
}
