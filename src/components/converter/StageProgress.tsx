import type { Stage } from '../../types/worker-protocol.ts';
import { IconCheck } from '../ui/icons.tsx';

export interface StageProgressProps {
  stage: Stage;
  percent: number;
  detail?: string;
  showOcr: boolean;
}

const LABELS: Array<{ key: string; label: string; stages: Stage[] }> = [
  { key: 'parse', label: 'Parse', stages: ['loading', 'probing', 'structure', 'text'] },
  { key: 'analyse', label: 'Analyse', stages: ['images', 'assembling'] },
  { key: 'ocr', label: 'OCR', stages: ['ocr'] },
  { key: 'package', label: 'Package', stages: ['packaging'] },
];

export function StageProgress({ stage, percent, detail, showOcr }: StageProgressProps) {
  const rows = LABELS.filter((row) => row.key !== 'ocr' || showOcr);
  const activeIndex = rows.findIndex((row) => row.stages.includes(stage));

  return (
    <section className="border-line bg-surface flex flex-col gap-5 rounded-lg border p-6">
      <ol className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={row.key} className="flex items-center gap-2.5 text-sm">
              <span
                className={[
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  done ? 'border-transparent bg-pale-green text-pale-green-ink' : '',
                  active ? 'border-ink' : '',
                  !done && !active ? 'border-line' : '',
                ].join(' ')}
              >
                {done && <IconCheck className="h-2.5 w-2.5" />}
              </span>
              <span className={active ? 'text-ink' : done ? 'text-ink-muted' : 'text-ink-muted/60'}>
                {row.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="bg-surface-sunken border-line h-1 w-full overflow-hidden rounded-full border"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* transform, not width — width animation triggers layout on every frame while pdf.js parses. */}
        <div
          className="bg-ink h-full origin-left transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${percent / 100})`, width: '100%' }}
        />
      </div>

      <p aria-live="polite" className="text-ink-muted font-mono text-xs">
        {detail ?? 'Working'} · {percent}%
      </p>
    </section>
  );
}
