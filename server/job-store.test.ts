import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

// job-store resolves JOBS_DIR from process.cwd() at module load.
let cwd: string
let root: string
let jobsDir: string

async function freshModule() {
  vi.resetModules()
  return import('./job-store')
}

beforeEach(() => {
  cwd = process.cwd()
  root = mkdtempSync(path.join(tmpdir(), 'wd-jobs-'))
  jobsDir = path.join(root, '.claude', 'jobs')
  process.chdir(root)
})

afterEach(() => {
  process.chdir(cwd)
  rmSync(root, { recursive: true, force: true })
})

const job = (over: Record<string, unknown> = {}) => ({
  jobId: 'job-abc-1', topic: 'gRPC', status: 'completed',
  startedAt: '2026-07-26T00:00:00.000Z', logs: [], lang: 'ja', writtenFiles: [],
  ...over,
})

describe('saveJob / loadAllJobs', () => {
  it('round-trips a job through disk', async () => {
    const s = await freshModule()
    s.saveJob('job-abc-1', job())
    const loaded = s.loadAllJobs()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].jobId).toBe('job-abc-1')
    expect(loaded[0].job.topic).toBe('gRPC')
  })

  it('creates the jobs directory on demand', async () => {
    const s = await freshModule()
    expect(existsSync(jobsDir)).toBe(false)
    s.saveJob('job-abc-1', job())
    expect(existsSync(jobsDir)).toBe(true)
  })

  // #24 regression guard: a job still 'running' when the server died has no
  // subprocess left, so it must come back as an interrupted error, not as a
  // job that appears to still be in flight.
  it('converts a running job to an interrupted error on load', async () => {
    const s = await freshModule()
    s.saveJob('job-run-1', job({ jobId: 'job-run-1', status: 'running' }))
    const loaded = s.loadAllJobs()
    expect(loaded[0].job.status).toBe('error')
    expect(String(loaded[0].job.message)).toContain('\u4e2d\u65ad')
    expect(loaded[0].job.completedAt).toBeTruthy()
    expect(Array.isArray(loaded[0].job.logs) && (loaded[0].job.logs as unknown[]).length).toBe(1)
  })

  it('persists the interruption so a second boot does not re-mark it', async () => {
    const s = await freshModule()
    s.saveJob('job-run-1', job({ jobId: 'job-run-1', status: 'running' }))
    s.loadAllJobs()
    const onDisk = JSON.parse(readFileSync(path.join(jobsDir, 'job-run-1.json'), 'utf-8'))
    expect(onDisk.status).toBe('error')
    const second = s.loadAllJobs()
    expect((second[0].job.logs as unknown[]).length).toBe(1)
  })

  it('keeps completed jobs untouched across a load', async () => {
    const s = await freshModule()
    s.saveJob('job-done', job({ jobId: 'job-done', status: 'completed', message: 'ok' }))
    const loaded = s.loadAllJobs()
    expect(loaded[0].job.status).toBe('completed')
    expect(loaded[0].job.message).toBe('ok')
  })

  it('skips unreadable and malformed files instead of failing the whole load', async () => {
    const s = await freshModule()
    s.saveJob('job-good', job({ jobId: 'job-good' }))
    writeFileSync(path.join(jobsDir, 'broken.json'), '{ not json', 'utf-8')
    writeFileSync(path.join(jobsDir, 'nojobid.json'), JSON.stringify({ topic: 'x' }), 'utf-8')
    const loaded = s.loadAllJobs()
    expect(loaded.map(l => l.jobId)).toEqual(['job-good'])
  })

  it('returns an empty list when nothing has been saved', async () => {
    const s = await freshModule()
    expect(s.loadAllJobs()).toEqual([])
  })

  it('sanitises job ids so they cannot escape the jobs directory', async () => {
    const s = await freshModule()
    s.saveJob('../../escape', job({ jobId: '../../escape' }))
    expect(existsSync(path.join(root, 'escape.json'))).toBe(false)
    expect(existsSync(path.join(jobsDir, '______escape.json'))).toBe(true)
  })
})

describe('deleteJob', () => {
  it('removes the persisted file', async () => {
    const s = await freshModule()
    s.saveJob('job-abc-1', job())
    s.deleteJob('job-abc-1')
    expect(s.loadAllJobs()).toEqual([])
  })

  it('is a no-op for an unknown id', async () => {
    const s = await freshModule()
    mkdirSync(jobsDir, { recursive: true })
    expect(() => s.deleteJob('nope')).not.toThrow()
  })
})

describe('persistJobDebounced / flushJob', () => {
  it('collapses a burst of writes into one', async () => {
    vi.useFakeTimers()
    try {
      const s = await freshModule()
      for (let i = 0; i < 10; i++) s.persistJobDebounced('job-x', job({ jobId: 'job-x', logs: Array(i).fill({}) }))
      expect(s.loadAllJobs()).toEqual([])   // nothing written yet
      vi.advanceTimersByTime(2000)
      const loaded = s.loadAllJobs()
      expect(loaded).toHaveLength(1)
      expect((loaded[0].job.logs as unknown[]).length).toBe(9)
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushJob writes immediately and cancels the pending debounce', async () => {
    vi.useFakeTimers()
    try {
      const s = await freshModule()
      s.persistJobDebounced('job-x', job({ jobId: 'job-x', status: 'running' }))
      s.flushJob('job-x', job({ jobId: 'job-x', status: 'completed' }))
      expect(s.loadAllJobs()[0].job.status).toBe('completed')
      vi.advanceTimersByTime(5000)
      expect(s.loadAllJobs()[0].job.status).toBe('completed')
    } finally {
      vi.useRealTimers()
    }
  })
})
