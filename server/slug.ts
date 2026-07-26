import path from 'path'

/**
 * Slug validation shared by every endpoint that maps a slug onto a file in
 * public/data. Keeping this in one place is an invariant: the import endpoint
 * used to skip validation entirely, which allowed a hand-crafted meta.slug to
 * write outside the data directory (issue #35).
 *
 * A slug must be a single path segment made of characters that are safe both
 * as a filename and inside a URL. Non-ASCII is rejected on purpose — slugs are
 * generated as ASCII by the research skill, and translated topics only append
 * a language suffix.
 */
const SLUG_PATTERN = /^[a-zA-Z0-9._-]+$/

export function isValidSlug(slug: unknown): slug is string {
  if (typeof slug !== 'string') return false
  if (slug.length === 0 || slug.length > 200) return false
  // Reject '.' and '..' outright, plus anything containing a separator or
  // NUL. The pattern below already excludes separators, but being explicit
  // keeps the intent obvious to readers.
  if (slug === '.' || slug === '..') return false
  if (slug.includes('/') || slug.includes('\\') || slug.includes('\0')) return false
  return SLUG_PATTERN.test(slug)
}

/**
 * Resolve `<dataDir>/<slug>.json` only when the slug is valid AND the resolved
 * path really stays inside dataDir. The second check is belt-and-braces
 * against platform-specific path quirks.
 */
export function resolveDataPath(dataDir: string, slug: string): string | null {
  if (!isValidSlug(slug)) return null
  const resolvedDir = path.resolve(dataDir)
  const target = path.resolve(resolvedDir, `${slug}.json`)
  if (path.dirname(target) !== resolvedDir) return null
  return target
}
