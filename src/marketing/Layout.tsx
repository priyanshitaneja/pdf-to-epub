import type { ReactNode } from 'react';

export interface LayoutProps {
  children: ReactNode;
}

/**
 * The page shell, shared by the converter page and the guides.
 *
 * Lifted out of `App.tsx` unchanged when the marketing content moved to build-time rendering, so
 * the measurements and their reasoning stay in one place rather than being restated per page.
 */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-dvh">
      {/*
        Full width on small screens, 70% from `lg` up, capped so it stops growing on ultrawide
        displays. The cap matters: past roughly 1500px the interactive surfaces stop gaining
        anything and the page just drifts apart.
      */}
      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:w-[70%] lg:px-0">
        {children}
      </main>
    </div>
  );
}
