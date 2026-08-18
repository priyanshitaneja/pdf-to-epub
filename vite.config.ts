import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

/**
 * pdf.js needs its cMaps and standard-font data available at runtime as plain files.
 * Without them, CJK text and any PDF relying on the 14 standard fonts extract as garbage.
 * The worker itself does NOT need copying — it is imported with `?url` and fingerprinted
 * by Vite.
 */
export const pdfjsCopyTargets = [
  { src: 'node_modules/pdfjs-dist/cmaps', dest: 'pdfjs' },
  { src: 'node_modules/pdfjs-dist/standard_fonts', dest: 'pdfjs' },
]

export default defineConfig({
  plugins: [react(), tailwindcss(), viteStaticCopy({ targets: pdfjsCopyTargets })],
  build: {
    // Top-level await inside module workers.
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
})
