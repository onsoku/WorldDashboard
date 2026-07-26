import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

// index-writer resolves INDEX_PATH from process.cwd() at module load, so each
// test chdirs into a scratch project and re-imports the module fresh.
let cwd: string
let root: string
let indexPath: string

async function freshModule() {
  vi.resetModules()
  return import('./index-writer')
}

function readIndex(): { topics: { slug: string; topic: string; createdAt: string; updatedAt?: string }[] } {
  return JSON.parse(readFileSync(indexPath, 'utf-8'))
}

beforeEach(() => {
  cwd = process.cwd()
  root = mkdtempSync(path.join(tmpdir(), 'wd-index-'))
  mkdirSync(path.join(root, 'public', 'data'), { recursive: true })
  indexPath = path.join(root, 'public', 'data', 'index.json')
  process.chdir(root)
})

afterEach(() => {
  process.chdir(cwd)
  rmSync(root, { recursive: true, force: true })
})

describe('updateIndex', () => {
  it('creates index.json on first write', async () => {
    const { updateIndex } = await freshModule()
    await updateIndex({ slug: 'grpc', topic: 'gRPC' })
    expect(readIndex().topics).toHaveLength(1)
    expect(readIndex().topics[0]).toMatchObject({ slug: 'grpc', topic: 'gRPC' })
  })

  // This is the #26 regression guard: parallel jobs used to last-write-wins
  // each other because every CLI subprocess did its own read-modify-write.
  it('loses no entries when many updates run concurrently', async () => {
    const { updateIndex } = await freshModule()
    const N = 50
    await Promise.all(
      Array.from({ length: N }, (_, i) => updateIndex({ slug: `topic-${i}`, topic: `Topic ${i}` })),
    )
    const topics = readIndex().topics
    expect(topics).toHaveLength(N)
    for (let i = 0; i < N; i++) {
      expect(topics.some(t => t.slug === `topic-${i}`), `topic-${i} missing`).toBe(true)
    }
  })

  it('replaces an existing slug and preserves its original createdAt', async () => {
    const { updateIndex } = await freshModule()
    await updateIndex({ slug: 'grpc', topic: 'gRPC' })
    const created = readIndex().topics[0].createdAt
    await new Promise(r => setTimeout(r, 5))
    await updateIndex({ slug: 'grpc', topic: 'gRPC (updated)', isUpdate: true })
    const topics = readIndex().topics
    expect(topics).toHaveLength(1)
    expect(topics[0].createdAt).toBe(created)
    expect(topics[0].topic).toBe('gRPC (updated)')
    expect(topics[0].updatedAt).toBeTruthy()
  })

  it('throws rather than overwriting an index.json it cannot parse', async () => {
    writeFileSync(indexPath, '{ this is not json', 'utf-8')
    const { updateIndex } = await freshModule()
    await expect(updateIndex({ slug: 'grpc', topic: 'gRPC' })).rejects.toBeTruthy()
    // The unreadable file must survive untouched so it can be recovered.
    expect(readFileSync(indexPath, 'utf-8')).toBe('{ this is not json')
  })

  it('keeps serving later calls after one rejects', async () => {
    writeFileSync(indexPath, 'broken', 'utf-8')
    const { updateIndex } = await freshModule()
    await expect(updateIndex({ slug: 'a', topic: 'A' })).rejects.toBeTruthy()
    writeFileSync(indexPath, JSON.stringify({ topics: [] }), 'utf-8')
    await updateIndex({ slug: 'b', topic: 'B' })
    expect(readIndex().topics.map(t => t.slug)).toEqual(['b'])
  })
})

describe('removeFromIndex', () => {
  it('removes only the named slug', async () => {
    const { updateIndex, removeFromIndex } = await freshModule()
    await updateIndex({ slug: 'a', topic: 'A' })
    await updateIndex({ slug: 'b', topic: 'B' })
    await removeFromIndex('a')
    expect(readIndex().topics.map(t => t.slug)).toEqual(['b'])
  })

  it('is a no-op for an unknown slug', async () => {
    const { updateIndex, removeFromIndex } = await freshModule()
    await updateIndex({ slug: 'a', topic: 'A' })
    await removeFromIndex('nope')
    expect(readIndex().topics.map(t => t.slug)).toEqual(['a'])
  })

  it('shares the mutex with updateIndex under concurrency', async () => {
    const { updateIndex, removeFromIndex } = await freshModule()
    await Promise.all(Array.from({ length: 20 }, (_, i) => updateIndex({ slug: `t-${i}`, topic: `T${i}` })))
    await Promise.all([
      ...Array.from({ length: 10 }, (_, i) => removeFromIndex(`t-${i}`)),
      ...Array.from({ length: 10 }, (_, i) => updateIndex({ slug: `n-${i}`, topic: `N${i}` })),
    ])
    const slugs = readIndex().topics.map(t => t.slug)
    expect(slugs).toHaveLength(20)
    for (let i = 0; i < 10; i++) {
      expect(slugs, `t-${i} should be gone`).not.toContain(`t-${i}`)
      expect(slugs, `t-${i + 10} should remain`).toContain(`t-${i + 10}`)
      expect(slugs, `n-${i} should be added`).toContain(`n-${i}`)
    }
  })
})
