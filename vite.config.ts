import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { PrerenderEnv, RenderedPage } from './src/seo/pages.ts'

/**
 * pdf.js's cMaps and standard-font data are synced into `public/pdfjs/` by
 * `scripts/sync-pdfjs-assets.mjs`, which runs on `predev` and `prebuild`. Vite serves `public/`
 * in dev and copies it into `dist/` on build, so one mechanism covers both.
 *
 * The pdf.js *worker* needs none of this — it is imported with `?url` in loadDocument.ts and
 * fingerprinted by Vite.
 */

/**
 * Render the static content into index.html during development.
 *
 * The production build does this in `scripts/prerender.mjs`, against a compiled SSR bundle. Dev
 * cannot use that bundle, but it can load the same entry module through `ssrLoadModule`, so both
 * paths run the same `buildPages` and the same `injectPage`. Without this, `npm run dev` would show
 * a bare converter with none of the surrounding page, and the content would be uneditable without
 * a full build between every change.
 */
function prerenderDev(): Plugin {
  let server: ViteDevServer | undefined

  return {
    name: 'prerender-dev',
    apply: 'serve',

    configureServer(devServer) {
      server = devServer
    },

    async transformIndexHtml(shell, ctx) {
      if (!server) return shell

      const mod = (await server.ssrLoadModule('/src/entry-prerender.tsx')) as {
        buildPages(env: PrerenderEnv): RenderedPage[]
        injectPage(input: {
          shell: string
          head: string
          body: string
          needsConverter: boolean
        }): string
      }

      /*
       * `noindex` in dev is belt and braces: nothing is reachable from the internet, but a dev
       * build accidentally deployed should not compete with the real origin. Analytics is off
       * because the endpoint only exists on Vercel.
       */
      const pages = mod.buildPages({ base: '/', noindex: true, analytics: false })

      // Vite's SPA fallback serves index.html for every path, so this is the route being asked for.
      const path = (ctx.originalUrl ?? '/').split('?')[0].replace(/\/+$/, '') || '/'
      const page = pages.find((candidate) => candidate.path === path)

      if (!page) return shell

      /*
       * The script tag is always kept in dev. Stripping it on a guide page would be accurate, but
       * it would also take the dev client and hot reload with it.
       */
      return mod.injectPage({
        shell,
        head: page.head,
        body: page.body,
        needsConverter: true,
      })
    },
  }
}

export default defineConfig({
  /**
   * Root by default, which is what Vercel serves. The GitHub Pages workflow sets
   * `VITE_BASE=/pdf-to-epub/` because Pages serves a project site from a sub-path; everything in
   * the app derives its asset URLs from `import.meta.env.BASE_URL` so both work unchanged.
   */
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), prerenderDev()],
  build: {
    // Top-level await inside module workers.
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
})
