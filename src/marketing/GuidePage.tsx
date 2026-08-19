import type { CSSProperties } from 'react';
import type { Guide } from '../content/guides.ts';
import { Footer } from './Footer.tsx';
import { href } from './href.ts';

export interface GuidePageProps {
  guide: Guide;
  base: string;
}

/**
 * A guide, rendered from content data.
 *
 * These pages ship no JavaScript at all: there is nothing interactive on them, so the prerenderer
 * omits the module script and they load as CSS and markup. That is most of why they are fast, and
 * they are the pages most likely to be someone's first arrival.
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
          <section
            key={section.heading}
            className="enter border-line flex flex-col gap-4 border-t pt-8"
            style={{ '--index': i + 1 } as CSSProperties}
          >
            <h2 className="font-serif text-2xl tracking-[-0.02em]">{section.heading}</h2>
            <div className="text-ink-soft flex max-w-[65ch] flex-col gap-4 text-base">
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
            </div>
          </section>
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
