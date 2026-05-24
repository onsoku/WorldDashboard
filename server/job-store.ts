// File-backed store for research jobs.
//
// Issue #24 follow-up: the previous global-polling fix made jobs survive a
// browser reload but the jobs map was still in-memory only, so a Vite dev
// server restart (or HMR reload that bounces the plugin) lost everything.
//
// This module mirrors the in-memory map to .claude/jobs/{jobId}.json so the
// server can rehydrate on boot. Live log appends are debounced to avoid
// hammering disk on every CLI stream chunk; terminal state changes flush
// synchronously.

import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  readdirSync, unlinkSync,
} from 'fs';
import path from 'path';
import { log } from './job-logger';

const JOBS_DIR = path.join(process.cwd(), '.claude', 'jobs');

function ensureDir(): void {
  if (!existsSync(JOBS_DIR)) mkdirSync(JOBS_DIR, { recursive: true });
}

// Defensive: jobIds are server-generated but kept ASCII-safe just in case.
function safeId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function jobPath(jobId: string): string {
  return path.join(JOBS_DIR, `${safeId(jobId)}.json`);
}

export function saveJob(jobId: string, job: unknown): void {
  ensureDir();
  try {
    writeFileSync(jobPath(jobId), JSON.stringify(job, null, 2), 'utf-8');
  } catch (e) {
    log('error', 'job.persist_failed', { jobId, error: String(e) });
  }
}

export function deleteJob(jobId: string): void {
  const p = jobPath(jobId);
  try {
    if (existsSync(p)) unlinkSync(p);
  } catch (e) {
    log('warn', 'job.delete_failed', { jobId, error: String(e) });
  }
}

export interface LoadedJob {
  jobId: string;
  // Shape matches ResearchJob in research-api.ts; kept loose here so we don't
  // import a cycle. The plugin re-asserts the type when it rehydrates.
  job: Record<string, unknown>;
}

export function loadAllJobs(): LoadedJob[] {
  ensureDir();
  const out: LoadedJob[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(JOBS_DIR).filter(f => f.endsWith('.json'));
  } catch (e) {
    log('warn', 'job.list_failed', { error: String(e) });
    return out;
  }
  for (const f of files) {
    try {
      const raw = readFileSync(path.join(JOBS_DIR, f), 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const jobId = parsed.jobId;
      if (typeof jobId !== 'string') {
        log('warn', 'job.load_skipped', { file: f, reason: 'missing jobId' });
        continue;
      }
      // A job that was 'running' when the server died can't be resumed — its
      // subprocess is gone. Mark it as errored so the UI reflects reality.
      if (parsed.status === 'running') {
        const now = new Date().toISOString();
        parsed.status = 'error';
        parsed.message = 'サーバ再起動により中断されました';
        if (!parsed.completedAt) parsed.completedAt = now;
        const logs = Array.isArray(parsed.logs) ? parsed.logs : [];
        logs.push({ timestamp: now, phase: 'error', message: parsed.message });
        parsed.logs = logs;
        // Persist the corrected state so we don't keep re-marking on every boot.
        try {
          writeFileSync(path.join(JOBS_DIR, f), JSON.stringify(parsed, null, 2), 'utf-8');
        } catch { /* best-effort */ }
        log('warn', 'job.restored_as_interrupted', { jobId });
      }
      out.push({ jobId, job: parsed });
    } catch (e) {
      log('warn', 'job.load_failed', { file: f, error: String(e) });
    }
  }
  log('info', 'job.restored', { count: out.length });
  return out;
}

// Per-job debouncer so a burst of addLog calls during streaming results in
// at most one disk write per PERSIST_DEBOUNCE_MS interval.
const pendingWrites = new Map<string, NodeJS.Timeout>();
const PERSIST_DEBOUNCE_MS = 1500;

export function persistJobDebounced(jobId: string, job: unknown): void {
  const existing = pendingWrites.get(jobId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pendingWrites.delete(jobId);
    saveJob(jobId, job);
  }, PERSIST_DEBOUNCE_MS);
  pendingWrites.set(jobId, t);
}

export function flushJob(jobId: string, job: unknown): void {
  const existing = pendingWrites.get(jobId);
  if (existing) {
    clearTimeout(existing);
    pendingWrites.delete(jobId);
  }
  saveJob(jobId, job);
}
