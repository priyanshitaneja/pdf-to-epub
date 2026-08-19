import type { EditableMeta } from '../../hooks/useConverterState.ts';

export interface MetadataPanelProps {
  meta: EditableMeta;
  /** True when the title was inferred rather than read from the PDF's own metadata. */
  titleGuessed: boolean;
  onChange(patch: Partial<EditableMeta>): void;
}

const LANGUAGES = [
  ['en', 'English'], ['hi', 'Hindi'], ['fr', 'French'], ['de', 'German'],
  ['es', 'Spanish'], ['pt', 'Portuguese'], ['it', 'Italian'], ['nl', 'Dutch'],
  ['ja', 'Japanese'], ['zh', 'Chinese'], ['ru', 'Russian'], ['ar', 'Arabic'],
] as const;

/** Capped: a full-width text input in a wide column is harder to scan, not easier. */
const FIELD =
  'border-line bg-surface focus:border-line-strong w-full max-w-lg rounded-md border px-3 py-2 text-sm transition-colors outline-none';

/**
 * Title, author and language, editable before download.
 *
 * A first-class panel rather than an advanced option: a wrong `dc:title` is the most common reason
 * a Kindle library looks like a pile of junk, and PDFs routinely carry titles like
 * "Microsoft Word - final_v3.docx".
 */
export function MetadataPanel({ meta, titleGuessed, onChange }: MetadataPanelProps) {
  return (
    <section className="border-line flex flex-col gap-4 border-t pt-6">
      <h2 className="font-serif text-2xl tracking-[-0.02em]">Library details</h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="meta-title" className="text-ink-soft flex items-center gap-2 text-xs">
          Title
          {titleGuessed && (
            <span className="bg-pale-yellow text-pale-yellow-ink rounded-full px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase">
              guessed
            </span>
          )}
        </label>
        <input
          id="meta-title"
          value={meta.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="meta-author" className="text-ink-soft text-xs">
          Author
        </label>
        <input
          id="meta-author"
          value={meta.author}
          placeholder="Comma-separated for multiple authors"
          onChange={(e) => onChange({ author: e.target.value })}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="meta-lang" className="text-ink-soft text-xs">
          Language
        </label>
        <select
          id="meta-lang"
          value={meta.language}
          onChange={(e) => onChange({ language: e.target.value })}
          className={FIELD}
        >
          {LANGUAGES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
