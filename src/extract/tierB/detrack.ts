/**
 * Undo letter-spacing that pdf.js has already baked into a text item's string.
 *
 * `joinRuns` recovers word boundaries from run geometry, but it only gets the chance when
 * pdf.js emits one run per glyph. For heavily tracked text pdf.js instead applies its *own*
 * space-insertion rule inside a single item, so a tracked kicker arrives as one run whose
 * `str` is already `"2 4 - W E E K E X E C U T I O N"`. By then the per-glyph positions are
 * gone and no amount of gap analysis can help — the repair has to work on the string.
 *
 * Confirmed against `career-plan-1cr-staff-frontend.pdf`, where exactly two lines are affected
 * (the page kicker and `M O D U L E 0`) while every body line extracts correctly.
 *
 * **Known limitation.** A word boundary that falls *inside* one of these runs is not
 * recoverable: pdf.js writes a single space both between letters and between words, so
 * `"2 4 - W E E K E X E C U T I O N"` collapses to `24-WEEKEXECUTION`. Boundaries that pdf.js
 * happened to emit as separate runs do survive. Callers should record a warning when this
 * fires. The real fix is per-glyph positions from `getOperatorList()`, which the table and
 * image work needs anyway — worth revisiting then.
 */

/** Minimum run of single-character tokens before a string is treated as tracked. */
const MIN_TRACKED_TOKENS = 4;

/**
 * Tokens that mark the string as something other than tracked text.
 *
 * An equation like `x = a + b` is five single-character tokens and looks identical to tracking
 * by run length alone, so run length is not a sufficient test. Operators are the discriminator:
 * letter-spaced display text does not contain them, and collapsing an equation to `x=a+b` would
 * be a regression rather than a repair.
 */
const OPERATOR_TOKENS = new Set(['=', '+', '*', '/', '<', '>', '±', '×', '÷', '≤', '≥', '≠']);

/** A single-character token that could plausibly be one glyph of a tracked word. */
function isGlyphToken(token: string): boolean {
  return token.length === 1 && /[\p{L}\p{N}]/u.test(token);
}

/**
 * True when the string looks like letter-spaced text rather than ordinary words.
 *
 * Requires a long run of single-character tokens that are specifically letters or digits, and
 * no operator tokens anywhere. The threshold is deliberately not 2 or 3: initials
 * (`J. R. R. Tolkien`) and short enumerations (`a b c`) produce short runs legitimately.
 */
export function looksTracked(text: string): boolean {
  const tokens = text.split(' ');
  if (tokens.some((t) => OPERATOR_TOKENS.has(t))) return false;
  return longestGlyphRun(tokens) >= MIN_TRACKED_TOKENS;
}

function longestGlyphRun(tokens: string[]): number {
  let best = 0;
  let current = 0;
  for (const token of tokens) {
    if (isGlyphToken(token)) {
      current += 1;
      best = Math.max(best, current);
    } else if (token.length === 1) {
      // Punctuation such as the hyphen in "2 4 - W E E K" sits inside a tracked span without
      // interrupting it, but does not on its own extend the run.
      continue;
    } else {
      current = 0;
    }
  }
  return best;
}

/**
 * Collapse letter-spacing in a single run's string.
 *
 * Only maximal runs of at least `MIN_TRACKED_TOKENS` single-character tokens are joined, so a
 * string that mixes tracked and untracked text keeps the untracked part intact.
 */
export function detrack(text: string): string {
  if (!looksTracked(text)) return text;

  const tokens = text.split(' ');
  const out: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length === 0) return;
    // Join without separators when the run is long enough to be tracking; otherwise restore
    // the spaces, since a short run is meaningful text.
    out.push(run.length >= MIN_TRACKED_TOKENS ? run.join('') : run.join(' '));
    run = [];
  };

  for (const token of tokens) {
    if (token.length === 1) {
      run.push(token);
      continue;
    }
    flush();
    out.push(token);
  }
  flush();

  return out.join(' ');
}

export interface DetrackResult {
  text: string;
  /** True when any part of the input was collapsed, so the caller can record a warning. */
  changed: boolean;
}

/** Apply `detrack` to a whole line, reporting whether anything changed. */
export function detrackLine(text: string): DetrackResult {
  const repaired = detrack(text);
  return { text: repaired, changed: repaired !== text };
}

/**
 * De-track a single run's string, collapsing it entirely when it looks tracked.
 *
 * This is the preferred entry point, and it is applied **before** runs are joined. Doing it
 * per-run is strictly better than repairing the joined line, because pdf.js emits explicit
 * space runs at genuine word boundaries: collapsing within a run and letting those separate
 * runs supply the spaces recovers `24-WEEKEXECUTION PLAN ·JULY2026` where line-level repair
 * produced `24-WEEKEXECUTIONPLAN·JU LY 2026`.
 *
 * A tracked run collapses completely rather than only at long single-character stretches. Once
 * the run is known to be tracked, every space inside it is a tracking artefact — the partial
 * rule left fragments like `JU LY` behind, because a two-character token such as `LY` (an
 * unspaced kern pair) interrupted the run without ending the tracking.
 */
export function detrackRun(text: string): DetrackResult {
  if (!looksTracked(text)) return { text, changed: false };
  const collapsed = text.split(' ').join('');
  return { text: collapsed, changed: collapsed !== text };
}
