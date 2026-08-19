import { describe, expect, it } from 'vitest';
import {
  FILENAME_STEM_MAX,
  epubFilename,
  sanitizeFilenameStem,
  stripIllegalFilenameChars,
} from './filename.ts';

describe('epubFilename', () => {
  it('joins title and first author', () => {
    expect(epubFilename('Roadmap', ['Priyanshi Taneja', 'Someone Else'], 'x.pdf')).toBe(
      'Roadmap - Priyanshi Taneja.epub',
    );
  });

  it('uses the title alone when there is no author', () => {
    expect(epubFilename('Roadmap', [], 'x.pdf')).toBe('Roadmap.epub');
  });

  it('falls back to the source name when the title is empty', () => {
    expect(epubFilename('', [], 'Frontend-Roadmap.pdf')).toBe('Frontend-Roadmap.epub');
  });

  it('falls back to a constant when everything is empty', () => {
    expect(epubFilename('', [], '.pdf')).toBe('converted.epub');
  });

  it('keeps non-ASCII, which a download name may contain', () => {
    expect(epubFilename('₹1Cr Roadmap', [], 'x.pdf')).toBe('₹1Cr Roadmap.epub');
  });

  it('caps the stem without letting a trailing dot survive the cut', () => {
    const out = epubFilename(`${'a'.repeat(FILENAME_STEM_MAX - 1)}. tail`, [], 'x.pdf');
    expect(out.endsWith('.epub')).toBe(true);
    expect(out).not.toMatch(/\.\.epub$/);
    expect(out.length).toBeLessThanOrEqual(FILENAME_STEM_MAX + '.epub'.length);
  });
});

describe('stripIllegalFilenameChars', () => {
  it('removes path and wildcard characters', () => {
    expect(stripIllegalFilenameChars('a/b\\c?d%e*f:g|h"i<j>k')).toBe('abcdefghijk');
  });

  it('removes C0 controls and DEL', () => {
    const bell = String.fromCharCode(7);
    const del = String.fromCharCode(0x7f);
    expect(stripIllegalFilenameChars(`a${bell}b${del}cd`)).toBe('abcd');
  });

  it('leaves interior and trailing whitespace alone, so typing a two-word name works', () => {
    expect(stripIllegalFilenameChars('My ')).toBe('My ');
    expect(stripIllegalFilenameChars('My  Book')).toBe('My  Book');
  });
});

describe('sanitizeFilenameStem', () => {
  it('collapses whitespace and trims dots and spaces at both ends', () => {
    expect(sanitizeFilenameStem('  ..My   Book.. ')).toBe('My Book');
  });

  it('reduces a stem of only dots and spaces to empty', () => {
    expect(sanitizeFilenameStem(' . . ')).toBe('');
  });
});
