/**
 * Turn a route path into a link that works under any base.
 *
 * GitHub Pages serves the project from a sub-path, so a root-relative href breaks there. Every
 * asset URL in the app already derives from the base for the same reason; internal links were the
 * one thing that had none, because until now there was only one page.
 */
export function href(base: string, path: string): string {
  return `${base}${path.replace(/^\//, '')}`;
}
