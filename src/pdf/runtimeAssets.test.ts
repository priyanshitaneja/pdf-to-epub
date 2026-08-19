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

  it('derives its URLs from BASE_URL so a sub-path deploy still resolves', async () => {
    const source = await readFile(join(root, 'src/pdf/loadDocument.ts'), 'utf8');

    // Hardcoding a leading slash breaks GitHub Pages, which serves this project from
    // /pdf-to-epub/. pdf.js does not raise on a failed cMap fetch - it silently garbles text - so
    // this is asserted rather than left to review.
    expect(source).toContain('import.meta.env.BASE_URL');
    expect(source).toMatch(/CMAP_URL = `\$\{BASE\}pdfjs\/cmaps\/`/);
    expect(source).toMatch(/STANDARD_FONTS_URL = `\$\{BASE\}pdfjs\/standard_fonts\/`/);
    expect(source).not.toMatch(/CMAP_URL = '\//);

    // The sub-paths those URLs resolve to must exist under public/, whatever the base is.
    for (const sub of ['pdfjs/cmaps', 'pdfjs/standard_fonts']) {
      const entries = await readdir(join(root, 'public', sub));
      expect(entries.length).toBeGreaterThan(0);
    }
  });
});
