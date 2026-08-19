import { describe, expect, it } from 'vitest';
import { detrack, detrackLine, detrackRun, looksTracked } from './detrack.ts';

describe('looksTracked', () => {
  it('recognises the real tracked kicker from the career-plan PDF', () => {
    expect(looksTracked('2 4 - W E E K E X E C U T I O N')).toBe(true);
    expect(looksTracked('M O D U L E')).toBe(true);
  });

  it('leaves initials alone', () => {
    expect(looksTracked('J. R. R. Tolkien')).toBe(false);
  });

  it('leaves a short enumeration alone', () => {
    expect(looksTracked('options a b c apply')).toBe(false);
  });

  it('leaves an equation alone', () => {
    expect(looksTracked('x = a + b')).toBe(false);
  });

  it('leaves ordinary prose alone', () => {
    expect(looksTracked('The quick brown fox jumps over the lazy dog')).toBe(false);
  });
});

describe('detrack', () => {
  it('collapses a tracked word', () => {
    expect(detrack('M O D U L E')).toBe('MODULE');
  });

  it('collapses the real kicker, keeping run-separated words apart', () => {
    // pdf.js emitted "P L A N" as its own run, so that boundary survives; the boundary inside
    // "W E E K E X E C U T I O N" does not, which is the documented limitation.
    expect(detrack('2 4 - W E E K E X E C U T I O N')).toBe('24-WEEKEXECUTION');
    expect(detrack('P L A N')).toBe('PLAN');
    expect(detrack('J A N U A R Y 2 0 2 7')).toBe('JANUARY2027');
  });

  it('does not touch a string with no long single-char run', () => {
    expect(detrack('J. R. R. Tolkien')).toBe('J. R. R. Tolkien');
    expect(detrack('x = a + b')).toBe('x = a + b');
  });

  it('preserves untracked words adjacent to a tracked span', () => {
    expect(detrack('Chapter M O D U L E here')).toBe('Chapter MODULE here');
  });

  it('restores spaces for a run too short to be tracking', () => {
    expect(detrack('M O D U L E and a b')).toBe('MODULE and a b');
  });

  it('is idempotent', () => {
    const once = detrack('M O D U L E');
    expect(detrack(once)).toBe(once);
  });
});

describe('detrackLine', () => {
  it('reports whether it changed anything, so a warning can be recorded', () => {
    expect(detrackLine('M O D U L E')).toEqual({ text: 'MODULE', changed: true });
    expect(detrackLine('ordinary text here')).toEqual({ text: 'ordinary text here', changed: false });
  });
});

describe('detrackRun: the preferred per-run entry point', () => {
  it('collapses a tracked run completely', () => {
    expect(detrackRun('M O D U L E').text).toBe('MODULE');
    expect(detrackRun('2 4 - W E E K E X E C U T I O N').text).toBe('24-WEEKEXECUTION');
  });

  it('collapses across an unspaced kern pair that the partial rule tripped on', () => {
    // "LY" arrives as one token because pdf.js did not space that pair. The old line-level rule
    // treated it as the end of the tracked stretch and left "J U LY" behind.
    expect(detrackRun('· J U LY 2 0 2 6').text).toBe('·JULY2026');
  });

  it('leaves an untracked run alone', () => {
    expect(detrackRun('Owner Priyanshi Taneja')).toEqual({
      text: 'Owner Priyanshi Taneja',
      changed: false,
    });
  });

  it('still refuses to touch an equation', () => {
    expect(detrackRun('x = a + b').changed).toBe(false);
  });

  it('reports the change so a warning can be recorded', () => {
    expect(detrackRun('M O D U L E').changed).toBe(true);
  });
});

describe('real-world regression strings', () => {
  // Captured verbatim from career-plan-1cr-staff-frontend.pdf page 1, where pdf.js had already
  // baked the tracking into each run's string.
  const RUNS = ['2 4 - W E E K E X E C U T I O N', ' ', 'P L A N', ' ', '· J U LY 2 0 2 6', ' ', '→', ' ', 'J A N U A R Y 2 0 2 7'];

  it('reconstructs the page kicker legibly', () => {
    const joined = RUNS.map((r) => (r === ' ' ? ' ' : detrackRun(r).text)).join('');
    expect(joined).toBe('24-WEEKEXECUTION PLAN ·JULY2026 → JANUARY2027');
    // The one boundary that cannot be recovered: pdf.js put "WEEK" and "EXECUTION" in the same
    // run with a single space, indistinguishable from the tracking. Documented in detrack.ts.
    expect(joined).toContain('24-WEEKEXECUTION');
    // Everything else must be intact.
    expect(joined).toContain('JULY2026');
    expect(joined).toContain('JANUARY2027');
    expect(joined).toContain(' PLAN ');
  });
});
