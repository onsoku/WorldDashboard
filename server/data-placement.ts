// Placement of the data file a job produced.
//
// The Claude CLI writes into a per-job staging directory, never straight into
// public/data. The move is the server's job, and it is the only point where a
// slug collision can still be caught: once the CLI has written over
// public/data/{slug}.json the previous encyclopedia is gone — no backup, no
// version history, and the files are gitignored so there is nothing to restore
// from (#42, which cost a real WebAssembly topic).
//
// Collision policy:
//   - fresh research — never touch the existing topic. Park the new one under
//     the next free {slug}-N and rewrite meta.slug to match.
//   - update / translate — the job owns that slug, so overwriting is the point.
//     The previous file is still copied to the trash directory first, because a
//     regeneration that comes back truncated would otherwise take the version
//     history with it.

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, unlinkSync, readdirSync,
} from 'fs'
import path from 'path'
import { isValidSlug } from './slug'

/** How far {slug}-2, {slug}-3 … is chased before giving up. */
const MAX_SUFFIX = 99

export interface PlacementRequest {
  /** File the CLI wrote into the staging directory. */
  stagedPath: string
  dataDir: string
  /** Where a file about to be overwritten is copied. */
  trashDir: string
  /**
   * Slug the job must land on (update / translate). Leave undefined for fresh
   * research, where the CLI picks the slug and collisions are possible.
   */
  expectedSlug?: string
  /** Suffix for the backup filename. Passed in so tests stay deterministic. */
  stamp: string
}

export interface Placement {
  slug: string
  path: string
  /** The slug the file asked for, set only when it had to land elsewhere. */
  collidedWith?: string
  /** Where the previous file was copied before an intentional overwrite. */
  backup?: string
}

/** JSON files a job staged, oldest first. Ignores anything that is not .json. */
export function listStagedFiles(stagingDir: string): string[] {
  if (!existsSync(stagingDir)) return []
  return readdirSync(stagingDir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => path.join(stagingDir, f))
}

/**
 * The slug a staged file asks for: meta.slug when it is present and valid,
 * otherwise the filename. Returns null when neither is usable — the caller
 * decides whether that is fatal.
 */
export function readStagedSlug(stagedPath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(stagedPath, 'utf-8')) as { meta?: { slug?: unknown } }
    if (isValidSlug(parsed.meta?.slug)) return parsed.meta.slug
  } catch {
    // Unparseable JSON still gets placed — the repair UI can only reach files
    // that live in public/data. Fall back to the filename.
  }
  const fromName = path.basename(stagedPath, '.json')
  return isValidSlug(fromName) ? fromName : null
}

/** First of {slug}, {slug}-2, {slug}-3 … with no file in dataDir. */
export function nextFreeSlug(dataDir: string, slug: string): string {
  if (!existsSync(path.join(dataDir, `${slug}.json`))) return slug
  for (let n = 2; n <= MAX_SUFFIX; n++) {
    const candidate = `${slug}-${n}`
    if (!existsSync(path.join(dataDir, `${candidate}.json`))) return candidate
  }
  throw new Error(`No free slug for "${slug}" after ${MAX_SUFFIX} attempts`)
}

/** Copy a file about to be overwritten into trashDir. Returns the copy's path. */
function backup(target: string, trashDir: string, slug: string, stamp: string): string {
  mkdirSync(trashDir, { recursive: true })
  const dest = path.join(trashDir, `${slug}-${stamp}.json`)
  copyFileSync(target, dest)
  return dest
}

/**
 * Move the staged file to target, making meta.slug agree with the filename.
 * Content that does not parse is copied verbatim so the repair action still
 * has something to work on.
 */
function moveInto(stagedPath: string, target: string, slug: string): void {
  const raw = readFileSync(stagedPath, 'utf-8')
  let out = raw
  try {
    const parsed = JSON.parse(raw) as { meta?: Record<string, unknown> }
    if (parsed.meta && parsed.meta.slug !== slug) {
      parsed.meta.slug = slug
      out = JSON.stringify(parsed, null, 2)
    }
  } catch {
    // Leave the bytes alone.
  }
  if (out === raw) copyFileSync(stagedPath, target)
  else writeFileSync(target, out, 'utf-8')
  unlinkSync(stagedPath)
}

export function placeStagedFile(req: PlacementRequest): Placement {
  const { stagedPath, dataDir, trashDir, expectedSlug, stamp } = req

  const requested = expectedSlug ?? readStagedSlug(stagedPath)
  if (!isValidSlug(requested)) {
    throw new Error(`Staged file has no usable slug: ${path.basename(stagedPath)}`)
  }

  mkdirSync(dataDir, { recursive: true })

  if (expectedSlug) {
    const target = path.join(dataDir, `${expectedSlug}.json`)
    const saved = existsSync(target) ? backup(target, trashDir, expectedSlug, stamp) : undefined
    moveInto(stagedPath, target, expectedSlug)
    return { slug: expectedSlug, path: target, backup: saved }
  }

  const free = nextFreeSlug(dataDir, requested)
  const target = path.join(dataDir, `${free}.json`)
  moveInto(stagedPath, target, free)
  return {
    slug: free,
    path: target,
    collidedWith: free === requested ? undefined : requested,
  }
}
