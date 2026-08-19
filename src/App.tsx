import { Converter } from './components/converter/Converter.tsx';

export default function App() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-20 sm:py-28">
        <header className="enter flex flex-col gap-4" style={{ '--index': 0 } as React.CSSProperties}>
          <h1 className="font-serif text-5xl leading-[1.1] tracking-[-0.03em] sm:text-6xl">
            PDF to EPUB,
            <br />
            cover intact.
          </h1>
          <p className="text-ink-soft max-w-lg text-base">
            Kindle finds a cover through a declaration most converters forget to write, so the book
            arrives as a grey placeholder. This one writes it, then checks the file before handing
            it over.
          </p>
        </header>

        <Converter />
      </main>
    </div>
  );
}
