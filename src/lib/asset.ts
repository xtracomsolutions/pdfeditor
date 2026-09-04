/** Resolve a /public asset path against the deploy base (e.g. GitHub Pages' /repo/). */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
