import { useState } from 'react';
import type { ValidationResult, Severity } from '../../epub/validate/types.ts';

export interface ValidationReportProps {
  validation: ValidationResult;
}

const STYLES: Record<Severity, string> = {
  error: 'text-danger',
  warning: 'text-warn',
  info: 'text-text-secondary',
};

/**
 * Shows what the self-validation pass found.
 *
 * Collapsed when everything passes, because a wall of green is noise; expanded automatically
 * when there is an error, because that is when the detail is the point.
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
        : 'Valid EPUB — all checks passed';

  return (
    <section className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2"
      >
        <span className={errors.length > 0 ? 'text-danger' : 'text-ok'}>
          {errors.length > 0 ? '✕' : '✓'}
        </span>
        <span className="font-medium">{summary}</span>
        {validation.issues.length > 0 && (
          <span className="text-text-secondary">{open ? '▾' : '▸'}</span>
        )}
      </button>

      {open && validation.issues.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {validation.issues.map((issue, i) => (
            <li key={`${issue.code}-${i}`} className="flex gap-2">
              <span className={STYLES[issue.severity]}>
                {issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '!' : 'i'}
              </span>
              <span>
                {issue.message}
                {issue.path && <span className="text-text-secondary"> ({issue.path})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
