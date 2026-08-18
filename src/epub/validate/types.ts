export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  /** Stable machine-readable code, used for tests and for grouping in the UI. */
  code: string;
  message: string;
  /** Archive path the issue concerns, when applicable. */
  path?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  /** True when there are no `error`-severity issues. */
  ok: boolean;
}

export function summarize(issues: ValidationIssue[]): ValidationResult {
  return { issues, ok: !issues.some((i) => i.severity === 'error') };
}
