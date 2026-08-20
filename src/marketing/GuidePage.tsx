import type { CSSProperties } from 'react';
import type { Guide } from '../content/guides.ts';
import { Footer } from './Footer.tsx';
import { Section } from './Section.tsx';
import { href } from './href.ts';

export interface GuidePageProps {
  guide: Guide;
  base: string;
}

/**
 * A guide, rendered from content data.
 *
 * Sections use the shared `Section`, so a guide reads with the same heading-beside-prose rhythm as
 * the converter page rather than as a second design. That also keeps the measure cap in one place.
 *
 * These pages ship no JavaScript at all: nothing on them is interactive, so the prerenderer omits
 * the module script and they load as markup and one stylesheet. They are the pages most likely to
 * be someone's first arrival, which is where that matters most.
 */
export function GuidePage({ guide, base }: GuidePageProps) {
  return (
    <>
      <article className="flex flex-col gap-8">
        <header className="enter flex flex-col gap-5" style={{ '--index': 0 } as CSSProperties}>
          {/* Matches the BreadcrumbList in structured data. */}
          <nav className="text-ink-muted text-sm">
            <a href={href(base, '/')} className="hover:text-ink underline">
              PDF to EPUB
            </a>
            <span aria-hidden="true"> / </span>
            <span>{guide.h1}</span>
          </nav>

          <h1 className="font-serif text-4xl leading-[1.1] tracking-[-0.03em] sm:text-5xl">
            {guide.h1}
          </h1>

          <div className="text-ink-soft flex max-w-[65ch] flex-col gap-4 text-lg">
            {guide.intro.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
        </header>

        {guide.sections.map((section, i) => (
          <Section key={section.heading} heading={section.heading} index={i + 1}>
            {section.paragraphs.map((para) => (
              <p key={para}>{para}</p>
            ))}
            {section.list && (
              <ul className="flex list-disc flex-col gap-2 pl-5">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.after?.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </Section>
        ))}

        <div
          className="enter border-line border-t pt-8"
          style={{ '--index': guide.sections.length + 1 } as CSSProperties}
        >
          <a
            href={href(base, '/')}
            className="bg-action text-canvas hover:bg-action-hover inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm no-underline"
          >
            Convert a PDF now
          </a>
        </div>
      </article>

      <Footer base={base} index={guide.sections.length + 2} showHomeLink />
    </>
  );
}
