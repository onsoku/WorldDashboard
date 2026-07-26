import { describe, it, expect } from 'vitest'
import path from 'path'
import { isValidSlug, resolveDataPath } from './slug'

describe('isValidSlug', () => {
  it('accepts the slug shapes the research skill generates', () => {
    for (const s of ['quantum-computing', 'hamburger-ja', 'grpc', 'ai-dlc', 'react', 'v1.2_draft']) {
      expect(isValidSlug(s), s).toBe(true)
    }
  })

  it('rejects path traversal', () => {
    for (const s of ['..', '../evil', '../../etc/passwd', 'a/../../b', '.']) {
      expect(isValidSlug(s), s).toBe(false)
    }
  })

  it('rejects separators and NUL', () => {
    for (const s of ['a/b', 'a\\b', 'a\0b', '/abs', 'C:\\win']) {
      expect(isValidSlug(s), s).toBe(false)
    }
  })

  it('rejects non-strings, empty, and over-long values', () => {
    for (const s of [undefined, null, 42, {}, [], '']) {
      expect(isValidSlug(s), String(s)).toBe(false)
    }
    expect(isValidSlug('a'.repeat(201))).toBe(false)
    expect(isValidSlug('a'.repeat(200))).toBe(true)
  })

  it('rejects non-ASCII, which slugs are never supposed to contain', () => {
    expect(isValidSlug('量子コンピューティング')).toBe(false)
  })
})

describe('resolveDataPath', () => {
  const dataDir = path.join('C:', 'proj', 'public', 'data')

  it('maps a valid slug to a file directly inside the data directory', () => {
    const p = resolveDataPath(dataDir, 'grpc')
    expect(p).not.toBeNull()
    expect(path.dirname(p as string)).toBe(path.resolve(dataDir))
    expect(path.basename(p as string)).toBe('grpc.json')
  })

  it('returns null instead of a path that escapes the data directory', () => {
    for (const s of ['../evil', '../../etc/passwd', 'sub/dir']) {
      expect(resolveDataPath(dataDir, s), s).toBeNull()
    }
  })
})
