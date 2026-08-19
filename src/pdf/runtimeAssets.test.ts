import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const root = join(import.meta.dirname, '..', '..');

/**
 * Guards the pdf.js runtime data files.
 *
 * These shipped broken once and nothing complained: vite-plugin-static-copy preserved the full
 * `node_modules/pdfjs-dist/...` source path inside the destination and served nothing in dev,
 * while still logging "Copied 185 items". A request for `/pdfjs/cmaps/...` returned Vite's
 * index.html with a 200, so pdf.js received HTML where it expected a cMap and silently produced
 * garbled text for CJK and base-14-font documents.
 *
 * The failure mode is invisible at runtime, so it needs a test rather than vigilance.
 */
describe('pdf.js runtime assets', () => {
  it('syncs cMaps and standard fonts into public/, where Vite serves them', async () => {
    await run('node', ['scripts/sync-pdfjs-assets.mjs'], { cwd: root });

    const cmaps = await readdir(join(root, 'public/pdfjs/cmaps'));
    const fonts = await readdir(join(root, 'public/pdfjs/standard_fonts'));

    expect(cmaps.length).toBeGreaterThan(100);
    expect(fonts.length).toBeGreaterThan(10);

    // Files, not nested directories: a nested path is exactly how this broke before.
    expect(cmaps).toContain('Adobe-Japan1-UCS2.bcmap');
    expect(cmaps).not.toContain('node_modules');
    expect(fonts.some((f) => f.endsWith('.pfb'))).toBe(true);
  }, 60_000);

  it('puts them at the URLs loadDocument.ts actually requests', async () => {
    // If these constants and the sync destinations ever drift apart, pdf.js gets HTML back.
    const source = await readFile(join(root, 'src/pdf/loadDocument.ts'), 'utf8');
    const cmapUrl = /CMAP_URL = '([^']+)'/.exec(source)?.[1];
    const fontUrl = /STANDARD_FONTS_URL = '([^']+)'/.exec(source)?.[1];

    expect(cmapUrl).toBe('/pdfjs/cmaps/');
    expect(fontUrl).toBe('/pdfjs/standard_fonts/');

    // The public/ path that Vite maps each URL onto must exist.
    for (const url of [cmapUrl!, fontUrl!]) {
      const entries = await readdir(join(root, 'public', url));
      expect(entries.length).toBeGreaterThan(0);
    }
  });
});
