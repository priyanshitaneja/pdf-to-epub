export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">PDF → EPUB</h1>
        <p className="text-text-secondary text-sm">
          Converts a PDF into a Kindle-ready EPUB that keeps its cover. Runs entirely in
          your browser — nothing is uploaded.
        </p>
      </header>
    </main>
  );
}
