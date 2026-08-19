/**
 * Rasterise scripts/assets/og.svg into public/og.png.
 *
 * macOS only, and run by hand rather than as part of `npm run build`. The output is committed, so
 * the deploy never needs a rasteriser and the project keeps its four runtime dependencies. The
 * only SVG renderer available without adding a native dependency is QuickLook, which fits to the
 * longest edge, so the source is a 1200x1200 square with the card centred and this crops the middle
 * 630 rows back out.
 *
 * Usage: npm run assets:og
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'darwin') {
  console.error('make-og needs macOS QuickLook. public/og.png is committed, so this is only');
  console.error('required when the artwork changes.');
  process.exit(1);
}

const src = join(root, 'scripts', 'assets', 'og.svg');
const out = join(root, 'public', 'og.png');
const scratch = await mkdtemp(join(tmpdir(), 'og-'));

try {
  await run('qlmanage', ['-t', '-s', '1200', '-o', scratch, src]);
  const square = join(scratch, 'og.svg.png');

  // sips -c takes height then width, and crops from the centre.
  await run('sips', ['-c', '630', '1200', square, '--out', out]);

  const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out]);
  console.log(`wrote public/og.png\n${stdout.trim()}`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
