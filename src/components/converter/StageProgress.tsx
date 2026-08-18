import type { Stage } from '../../types/worker-protocol.ts';

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
    <div className="flex flex-col gap-3">
      <div
        className="bg-border h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-accent h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {rows.map((row, index) => (
          <span
            key={row.key}
            className={
              index < activeIndex
                ? 'text-ok'
                : index === activeIndex
                  ? 'text-text-primary font-medium'
                  : 'text-text-secondary'
            }
          >
            {index < activeIndex ? '✓ ' : ''}
            {row.label}
          </span>
        ))}
      </div>
      <p aria-live="polite" className="text-text-secondary text-sm">
        {detail ?? 'Working…'} ({percent}%)
      </p>
    </div>
  );
}
