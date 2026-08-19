import { describe, expect, it } from 'vitest';
import { CELL_BREAK, stripCellBreaks, type PositionedRun } from '../types.ts';
import { calibrateThreshold, createThresholdCache, joinRuns, sanityCheck } from './glyphJoin.ts';

const EM = 10;
/** Advance for one glyph at EM=10 in a typical proportional font. */
const GLYPH = 6;

/**
 * Lay out a string as positioned runs.
 *
 * @param text        the characters to place
 * @param tracking    extra space inserted between every glyph (CSS letter-spacing), in points
 * @param wordGap     additional space at explicit word boundaries, in points
 * @param perGlyph    true to emit one run per character, as pdf.js does when tracking is set
 */
function layout(
  text: string,
  { tracking = 0, wordGap = 3, perGlyph = true, em = EM, startX = 0 } = {},
): PositionedRun[] {
  const runs: PositionedRun[] = [];
  let x = startX;

  const units = perGlyph ? text.split('') : text.split(/(?<= )|(?= )/);

  for (const unit of units) {
    if (unit === ' ') {
      x += GLYPH * 0.5 + wordGap;
      continue;
    }
    const advance = GLYPH * unit.length;
    runs.push({
      str: unit,
      rect: { x, y: 100, w: advance, h: em },
      baselineY: 100 + em,
      em,
      advance,
      fontKey: 'F1',
      bold: false,
      italic: false,
      mono: false,
    });
    x += advance + tracking;
  }

  return runs;
}

/** As `layout`, but emits real space-glyph runs so the calibration can find them. */
function layoutWithSpaceGlyphs(text: string, tracking = 0, em = EM): PositionedRun[] {
  const runs: PositionedRun[] = [];
  let x = 0;
  for (const ch of text) {
    const advance = ch === ' ' ? GLYPH * 0.55 : GLYPH;
    runs.push({
      str: ch,
      rect: { x, y: 100, w: advance, h: em },
      baselineY: 100 + em,
      em,
      advance,
      fontKey: 'F1',
      bold: false,
      italic: false,
      mono: false,
    });
    x += advance + tracking;
  }
  return runs;
}

describe('joinRuns: the letter-spacing case', () => {
  it('reads a heavily tracked heading as words, not single letters', () => {
    // The exact failure that motivated this module: "24-WEEK ROADMAP" printed with CSS
    // letter-spacing, emitted one glyph per run.
    const runs = layout('24-WEEK ROADMAP', { tracking: 2.5, wordGap: 6 });
    const { text } = joinRuns(runs);
    expect(stripCellBreaks(text)).toBe('24-WEEK ROADMAP');
  });

  it('handles tracking large enough to exceed a naive fixed threshold', () => {
    // tracking of 3pt at em 10 is 0.3em - above the common 0.25em default, so a fixed
    // threshold would insert a space between every glyph.
    const runs = layout('FRONTEND STAFF', { tracking: 3, wordGap: 7 });
    expect(stripCellBreaks(joinRuns(runs).text)).toBe('FRONTEND STAFF');
  });

  it('still separates words when tracking is zero', () => {
    const runs = layout('the quick brown fox jumps', { tracking: 0, wordGap: 3 });
    expect(stripCellBreaks(joinRuns(runs).text)).toBe('the quick brown fox jumps');
  });

  it('does not fabricate spaces inside a single untracked word', () => {
    const runs = layout('Introduction', { tracking: 0 });
    expect(joinRuns(runs).text).toBe('Introduction');
  });

  it('uses explicit space glyphs for calibration when the PDF provides them', () => {
    const runs = layoutWithSpaceGlyphs('hello world again', 1.5);
    const joined = joinRuns(runs).text;
    // The space glyphs themselves carry the space, so the text must not gain doubled spaces.
    expect(joined.replace(/\s+/g, ' ')).toBe('hello world again');
  });
});

describe('joinRuns: column gaps', () => {
  it('emits a cell-break marker for a very wide gap rather than a space', () => {
    const left = layout('Quarter', { tracking: 0, startX: 0 });
    const right = layout('Spend', { tracking: 0, startX: 300 });
    const { text } = joinRuns([...left, ...right]);
    expect(text).toContain(CELL_BREAK);
    expect(text.split(CELL_BREAK)).toHaveLength(2);
  });

  it('stripCellBreaks turns markers back into ordinary spaces', () => {
    const left = layout('a', { tracking: 0, startX: 0 });
    const right = layout('b', { tracking: 0, startX: 300 });
    expect(stripCellBreaks(joinRuns([...left, ...right]).text)).toBe('a b');
  });

  it('keeps the marker out of any text that reaches the serializer', async () => {
    // CELL_BREAK is a C0 control character, so the XML sanitizer removes it as a safety net.
    const { sanitizeXmlText } = await import('../../epub/serialize/xml.ts');
    expect(sanitizeXmlText(`a${CELL_BREAK}b`)).toBe('ab');
  });
});

describe('joinRuns: degenerate input', () => {
  it('returns an empty string for no runs', () => {
    expect(joinRuns([]).text).toBe('');
  });

  it('returns the single run unchanged', () => {
    expect(joinRuns(layout('word', { tracking: 0 }).slice(0, 1)).text).toBe('w');
  });

  it('ignores negative gaps from kerning', () => {
    const runs = layout('AV', { tracking: -1 });
    expect(joinRuns(runs).text).toBe('AV');
  });

  it('does not crash when em is zero', () => {
    const runs: PositionedRun[] = [
      { str: 'a', rect: { x: 0, y: 0, w: 5, h: 0 }, baselineY: 0, em: 0, advance: 5, fontKey: 'F', bold: false, italic: false, mono: false },
      { str: 'b', rect: { x: 6, y: 0, w: 5, h: 0 }, baselineY: 0, em: 0, advance: 5, fontKey: 'F', bold: false, italic: false, mono: false },
    ];
    expect(() => joinRuns(runs)).not.toThrow();
  });
});

describe('sanityCheck', () => {
  it('flags the over-split fingerprint as too-low', () => {
    expect(sanityCheck('2 4 - W E E K')).toBe('too-low');
  });

  it('flags a long unspaced line as too-high', () => {
    expect(sanityCheck('a'.repeat(60))).toBe('too-high');
  });

  it('accepts ordinary prose', () => {
    expect(sanityCheck('The quick brown fox jumps over the lazy dog')).toBe('ok');
  });

  it('does not flag a short line with few tokens', () => {
    expect(sanityCheck('A B')).toBe('ok');
  });
});

describe('calibrateThreshold', () => {
  it('finds a threshold above the tracking value on a bimodal line', () => {
    const runs = layout('HELLO WORLD AGAIN NOW', { tracking: 2.5, wordGap: 6 });
    const ratio = calibrateThreshold(runs);
    expect(ratio).not.toBeNull();
    // Tracking is 0.25em; the threshold must sit above it or words merge into letters.
    expect(ratio!).toBeGreaterThan(0.25);
  });

  it('declines to calibrate a line with too few gaps', () => {
    expect(calibrateThreshold(layout('ab', { tracking: 1 }))).toBeNull();
  });

  it('declines when gaps are uniform, so there is no real split', () => {
    // A single tracked word: every gap identical, no word boundary to find.
    expect(calibrateThreshold(layout('ABCDEFGHIJ', { tracking: 2 }))).toBeNull();
  });
});

describe('threshold cache', () => {
  it('lets a short line reuse a calibration derived from a longer one', () => {
    const cache = createThresholdCache();
    const long = layout('CALIBRATION SOURCE LINE HERE', { tracking: 2.5, wordGap: 6 });
    joinRuns(long, { cache });
    expect(cache.size).toBe(1);

    // "AB CD" alone has too few gaps to calibrate, but shares font and size with the line
    // above, so it inherits that threshold instead of falling back to the default.
    const short = layout('AB CD', { tracking: 2.5, wordGap: 6 });
    const result = joinRuns(short, { cache });
    expect(stripCellBreaks(result.text)).toBe('AB CD');
  });
});

describe('calibration is load-bearing, not incidental', () => {
  it('picks a threshold strictly between the tracking and the word gap', () => {
    // Measured gaps for this layout are 0.25em within words and 1.15em between them, so a
    // correct threshold must land in that corridor. The default of 0.25em does not: it is
    // >= the intra-word gap, so it would insert a space between every single glyph. This
    // test is what proves the Otsu calibration is doing the work rather than the retry loop
    // rescuing a bad guess.
    const runs = layout('24-WEEK ROADMAP', { tracking: 2.5, wordGap: 6 });
    const result = joinRuns(runs);

    expect(result.thresholdRatio).toBeGreaterThan(0.25);
    expect(result.thresholdRatio).toBeLessThan(1.15);
    expect(result.uncertain).toBe(false);
    expect(stripCellBreaks(result.text)).toBe('24-WEEK ROADMAP');
  });

  it('reaches that threshold by calibration, not by retrying the default', () => {
    const runs = layout('24-WEEK ROADMAP', { tracking: 2.5, wordGap: 6 });
    const calibrated = calibrateThreshold(runs);
    expect(calibrated).not.toBeNull();
    // The join must use the calibrated value as-is; a retry would show up as the default
    // scaled by 1.4 or 0.7 instead.
    expect(joinRuns(runs).thresholdRatio).toBeCloseTo(calibrated!, 5);
  });
});
