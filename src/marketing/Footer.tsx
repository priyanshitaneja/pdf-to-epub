import type { CSSProperties } from 'react';
import { REPO_URL } from '../content/site.ts';
import { GUIDES } from '../content/guides.ts';
import { href } from './href.ts';

export interface FooterProps {
  base: string;
  index: number;
  /** Omitted on the home page, where linking to itself adds nothing. */
  showHomeLink?: boolean;
}

export function Footer({ base, index, showHomeLink = false }: FooterProps) {
  return (
    <footer
      className="enter border-line text-ink-muted flex flex-col gap-6 border-t pt-8 text-sm"
      style={{ '--index': index } as CSSProperties}
    >
      <nav className="flex flex-col gap-2">
        <h2 className="text-ink-soft text-xs tracking-[0.05em] uppercase">Guides</h2>
        {showHomeLink && (
          <a href={href(base, '/')} className="hover:text-ink underline">
            PDF to EPUB converter
          </a>
        )}
        {GUIDES.map((guide) => (
          <a key={guide.path} href={href(base, guide.path)} className="hover:text-ink underline">
            {guide.h1}
          </a>
        ))}
      </nav>

      <p className="max-w-[65ch]">
        Runs entirely in your browser. Free, with no advertising and no account. The source is on{' '}
        <a href={REPO_URL} className="hover:text-ink underline">
          GitHub
        </a>
        .
      </p>
    </footer>
  );
}
