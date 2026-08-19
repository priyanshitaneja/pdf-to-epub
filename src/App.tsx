import { Converter } from './components/converter/Converter.tsx';

export default function App() {
  return (
    <div className="min-h-dvh">
      {/*
        Full width on small screens, 70% from `lg` up, capped so it stops growing on ultrawide
        displays. The cap matters: past roughly 1500px the interactive surfaces stop gaining
        anything and the page just drifts apart.
      */}
      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:w-[70%] lg:px-0">
        <header className="enter flex flex-col gap-5" style={{ '--index': 0 } as React.CSSProperties}>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            PDF to EPUB,
            <br />
            cover intact.
          </h1>
          {/*
            Measure-constrained independently of the container. A 70%-wide paragraph on a large
            display runs past 150 characters a line, which is where reading falls apart.
          */}
          <p className="text-ink-soft max-w-[60ch] text-base sm:text-lg">
            Kindle finds a cover through a declaration most converters forget to write, so the book
            arrives as a grey placeholder. This one writes it, then checks the file before handing it
            over.
          </p>
        </header>

        <Converter />
      </main>
    </div>
  );
}
