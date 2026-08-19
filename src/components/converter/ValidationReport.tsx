import { useState } from 'react';
import type { Severity, ValidationResult } from '../../epub/validate/types.ts';
import { IconAlert, IconCheck, IconChevron, IconCross, IconInfo } from '../ui/icons.tsx';

export interface ValidationReportProps {
  validation: ValidationResult;
}

const SKIN: Record<Severity, { chip: string; Icon: typeof IconCheck }> = {
  error: { chip: 'bg-pale-red text-pale-red-ink', Icon: IconCross },
  warning: { chip: 'bg-pale-yellow text-pale-yellow-ink', Icon: IconAlert },
  info: { chip: 'bg-pale-blue text-pale-blue-ink', Icon: IconInfo },
};

/**
 * What the self-validation pass found.
 *
 * Collapsed when everything passes, because a wall of green is noise; expanded automatically when
 * there is an error, because that is when the detail is the point. This is the trust surface — the
 * claim that the file is actually valid has to be inspectable, not just asserted.
 */
export function ValidationReport({ validation }: ValidationReportProps) {
  const errors = validation.issues.filter((i) => i.severity === 'error');
  const warnings = validation.issues.filter((i) => i.severity === 'warning');
  const [open, setOpen] = useState(errors.length > 0);

  const summary =
    errors.length > 0
      ? `${errors.length} problem${errors.length === 1 ? '' : 's'} found`
      : warnings.length > 0
        ? `Valid, with ${warnings.length} note${warnings.length === 1 ? '' : 's'}`
        : 'Valid EPUB — every check passed';

  const ok = errors.length === 0;

  return (
    <section className="border-line border-t pt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={validation.issues.length === 0}
        className="flex w-full items-center gap-3 text-left disabled:cursor-default"
      >
        <span
          className={[
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
            ok ? 'bg-pale-green text-pale-green-ink' : 'bg-pale-red text-pale-red-ink',
          ].join(' ')}
        >
          {ok ? <IconCheck className="h-3 w-3" /> : <IconCross className="h-3 w-3" />}
        </span>
        <span className="flex-1 text-sm">{summary}</span>
        {validation.issues.length > 0 && (
          <IconChevron
            className={`text-ink-muted h-4 w-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
        )}
      </button>

      {open && validation.issues.length > 0 && (
        <ul className="mt-4 flex flex-col">
          {validation.issues.map((issue, i) => {
            const { chip, Icon } = SKIN[issue.severity];
            return (
              <li
                key={`${issue.code}-${i}`}
                className="border-line enter flex gap-3 border-b py-3 last:border-b-0"
                style={{ '--index': i } as React.CSSProperties}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${chip}`}>
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-ink-soft text-sm">{issue.message}</span>
                  <span className="text-ink-muted font-mono text-[11px]">
                    {issue.code}
                    {issue.path ? ` · ${issue.path}` : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
