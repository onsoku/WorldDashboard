import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { placeStagedFile, listStagedFiles, readStagedSlug, nextFreeSlug } from './data-placement'

let root: string
let dataDir: string
let stagingDir: string
let trashDir: string

const STAMP = '2026-07-26T00-00-00-000Z'

/** Write a staged file the way the CLI would, and return its path. */
const stage = (filename: string, content: unknown) => {
  const p = path.join(stagingDir, filename)
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf-8')
  return p
}

const topic = (slug: string, extra: Record<string, unknown> = {}) => ({
  meta: { topic: `Topic ${slug}`, slug },
  overview: { summary: 'body' },
  ...extra,
})

const readData = (slug: string) =>
  JSON.parse(readFileSync(path.join(dataDir, `${slug}.json`), 'utf-8'))

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'wd-place-'))
  dataDir = path.join(root, 'public', 'data')
  stagingDir = path.join(root, '.claude', 'tmp', 'staging', 'job-1')
  trashDir = path.join(root, '.claude', 'trash')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(stagingDir, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('listStagedFiles', () => {
  it('returns the json files a job staged', () => {
    stage('a.json', topic('a'))
    stage('notes.txt', 'ignored')
    expect(listStagedFiles(stagingDir).map((f) => path.basename(f))).toEqual(['a.json'])
  })

  it('returns nothing when the job wrote elsewhere', () => {
    expect(listStagedFiles(path.join(root, 'nope'))).toEqual([])
  })
})

describe('readStagedSlug', () => {
  it('prefers meta.slug over the filename', () => {
    expect(readStagedSlug(stage('whatever.json', topic('quantum-computing')))).toBe('quantum-computing')
  })

  it('falls back to the filename when meta.slug is missing or unsafe', () => {
    expect(readStagedSlug(stage('fallback.json', { meta: { topic: 't' } }))).toBe('fallback')
    expect(readStagedSlug(stage('safe.json', { meta: { slug: '../../etc/passwd' } }))).toBe('safe')
  })

  it('falls back to the filename when the JSON does not parse', () => {
    expect(readStagedSlug(stage('broken.json', '{"meta":{"slug":"broken'))).toBe('broken')
  })
})

describe('nextFreeSlug', () => {
  it('returns the slug itself when nothing occupies it', () => {
    expect(nextFreeSlug(dataDir, 'webassembly')).toBe('webassembly')
  })

  it('counts up past every taken suffix', () => {
    for (const s of ['webassembly', 'webassembly-2', 'webassembly-3']) {
      writeFileSync(path.join(dataDir, `${s}.json`), '{}', 'utf-8')
    }
    expect(nextFreeSlug(dataDir, 'webassembly')).toBe('webassembly-4')
  })
})

describe('placeStagedFile - fresh research', () => {
  it('places the file at its own slug when there is no collision', () => {
    const staged = stage('quantum.json', topic('quantum'))
    const result = placeStagedFile({ stagedPath: staged, dataDir, trashDir, stamp: STAMP })

    expect(result.slug).toBe('quantum')
    expect(result.collidedWith).toBeUndefined()
    expect(readData('quantum').meta.topic).toBe('Topic quantum')
    expect(existsSync(staged)).toBe(false)
  })

  // The #42 regression: a fresh research job that lands on an existing slug
  // used to overwrite it, losing the topic and its version history for good.
  it('never touches the existing topic on a collision', () => {
    const existing = { meta: { topic: 'WebAssembly', slug: 'webassembly' }, versions: [1, 2, 3] }
    writeFileSync(path.join(dataDir, 'webassembly.json'), JSON.stringify(existing), 'utf-8')

    const staged = stage('webassembly.json', topic('webassembly'))
    const result = placeStagedFile({ stagedPath: staged, dataDir, trashDir, stamp: STAMP })

    expect(result.slug).toBe('webassembly-2')
    expect(result.collidedWith).toBe('webassembly')
    expect(readData('webassembly')).toEqual(existing)
    expect(readData('webassembly-2').meta.topic).toBe('Topic webassembly')
  })

  it('rewrites meta.slug so it agrees with where the file landed', () => {
    writeFileSync(path.join(dataDir, 'react.json'), '{}', 'utf-8')
    const staged = stage('react.json', topic('react'))

    const result = placeStagedFile({ stagedPath: staged, dataDir, trashDir, stamp: STAMP })

    expect(result.slug).toBe('react-2')
    expect(readData('react-2').meta.slug).toBe('react-2')
  })

  it('places a file that does not parse, so the repair action can reach it', () => {
    const staged = stage('cut-off.json', '{"meta":{"slug":"cut-off"},"overview":')

    const result = placeStagedFile({ stagedPath: staged, dataDir, trashDir, stamp: STAMP })

    expect(result.slug).toBe('cut-off')
    expect(readFileSync(result.path, 'utf-8')).toBe('{"meta":{"slug":"cut-off"},"overview":')
  })

  it('refuses a staged file with no usable slug anywhere', () => {
    const staged = stage('..json', { meta: { slug: '../escape' } })
    expect(() => placeStagedFile({ stagedPath: staged, dataDir, trashDir, stamp: STAMP }))
      .toThrow(/no usable slug/)
  })

  it('does not let meta.slug escape the data directory', () => {
    const staged = stage('safe.json', { meta: { topic: 't', slug: '../../evil' } })

    const result = placeStagedFile({ stagedPath: staged, dataDir, trashDir, stamp: STAMP })

    expect(result.slug).toBe('safe')
    expect(path.dirname(result.path)).toBe(dataDir)
    expect(existsSync(path.join(root, 'evil.json'))).toBe(false)
  })
})

describe('placeStagedFile - update and translate', () => {
  it('overwrites its own slug, keeping a copy of what was there', () => {
    const before = { meta: { topic: 'React', slug: 'react' }, versions: [1] }
    writeFileSync(path.join(dataDir, 'react.json'), JSON.stringify(before), 'utf-8')
    const staged = stage('react.json', topic('react', { versions: [1, 2] }))

    const result = placeStagedFile({
      stagedPath: staged, dataDir, trashDir, expectedSlug: 'react', stamp: STAMP,
    })

    expect(result.slug).toBe('react')
    expect(result.collidedWith).toBeUndefined()
    expect(readData('react').versions).toEqual([1, 2])
    expect(JSON.parse(readFileSync(result.backup as string, 'utf-8'))).toEqual(before)
    expect(readdirSync(trashDir)).toEqual([`react-${STAMP}.json`])
  })

  it('takes no backup when the target does not exist yet', () => {
    const staged = stage('react-en.json', topic('react-en'))

    const result = placeStagedFile({
      stagedPath: staged, dataDir, trashDir, expectedSlug: 'react-en', stamp: STAMP,
    })

    expect(result.backup).toBeUndefined()
    expect(existsSync(trashDir)).toBe(false)
  })

  it('lands on the expected slug even when the CLI wrote a different one', () => {
    const staged = stage('wrong.json', topic('wrong'))

    const result = placeStagedFile({
      stagedPath: staged, dataDir, trashDir, expectedSlug: 'react-fr', stamp: STAMP,
    })

    expect(result.slug).toBe('react-fr')
    expect(readData('react-fr').meta.slug).toBe('react-fr')
    expect(existsSync(path.join(dataDir, 'wrong.json'))).toBe(false)
  })
})
