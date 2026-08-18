import type { EditableMeta } from '../../hooks/useConverterState.ts';

export interface MetadataPanelProps {
  meta: EditableMeta;
  /** True when the title was inferred rather than read from the PDF's own metadata. */
  titleGuessed: boolean;
  onChange(patch: Partial<EditableMeta>): void;
}

const LANGUAGES = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['fr', 'French'],
  ['de', 'German'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
  ['it', 'Italian'],
  ['nl', 'Dutch'],
  ['ja', 'Japanese'],
  ['zh', 'Chinese'],
  ['ru', 'Russian'],
  ['ar', 'Arabic'],
] as const;

/**
 * Title, author and language, editable before download.
 *
 * Worth having as a first-class panel: a wrong `dc:title` is the single most common reason a
 * Kindle library looks like a pile of junk, and PDFs very often carry a title like
 * "Microsoft Word - final_v3.docx".
 */
export function MetadataPanel({ meta, titleGuessed, onChange }: MetadataPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="meta-title" className="text-sm font-medium">
          Title
          {titleGuessed && (
            <span className="bg-warn/15 text-warn ml-2 rounded px-1.5 py-0.5 text-xs font-normal">
              guessed from filename
            </span>
          )}
        </label>
        <input
          id="meta-title"
          value={meta.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="border-border bg-surface-raised rounded-lg border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="meta-author" className="text-sm font-medium">
          Author
        </label>
        <input
          id="meta-author"
          value={meta.author}
          placeholder="Comma-separated for multiple authors"
          onChange={(e) => onChange({ author: e.target.value })}
          className="border-border bg-surface-raised rounded-lg border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="meta-lang" className="text-sm font-medium">
          Language
        </label>
        <select
          id="meta-lang"
          value={meta.language}
          onChange={(e) => onChange({ language: e.target.value })}
          className="border-border bg-surface-raised rounded-lg border px-3 py-2"
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
