import { Hero } from './Hero.tsx';
import { ConverterSlot } from './ConverterSlot.tsx';
import { HowItWorks } from './HowItWorks.tsx';
import { CoverExplainer } from './CoverExplainer.tsx';
import { Costs } from './Costs.tsx';
import { Comparison } from './Comparison.tsx';
import { Faq } from './Faq.tsx';
import { Footer } from './Footer.tsx';

/**
 * The converter page.
 *
 * Everything except the converter itself is static markup produced at build time. The staggered
 * entry indices continue the sequence the converter uses internally, which claims 1 and 2, so the
 * content sections start at 3 and the page animates top to bottom as one movement.
 */
export function HomePage({ base }: { base: string }) {
  return (
    <>
      <Hero />
      <ConverterSlot />
      <HowItWorks index={3} />
      <CoverExplainer index={4} />
      <Costs index={5} />
      <Comparison index={6} />
      <Faq index={7} />
      <Footer base={base} index={8} />
    </>
  );
}
