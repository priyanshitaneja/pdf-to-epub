import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * pdf.js's cMaps and standard-font data are synced into `public/pdfjs/` by
 * `scripts/sync-pdfjs-assets.mjs`, which runs on `predev` and `prebuild`. Vite serves `public/`
 * in dev and copies it into `dist/` on build, so one mechanism covers both.
 *
 * The pdf.js *worker* needs none of this — it is imported with `?url` in loadDocument.ts and
 * fingerprinted by Vite.
 */
export default defineConfig({
  /**
   * Root by default, which is what Vercel serves. The GitHub Pages workflow sets
   * `VITE_BASE=/pdf-to-epub/` because Pages serves a project site from a sub-path; everything in
   * the app derives its asset URLs from `import.meta.env.BASE_URL` so both work unchanged.
   */
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    // Top-level await inside module workers.
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
})
