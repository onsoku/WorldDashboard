// Centralised, mutex-protected writer for public/data/index.json.
//
// Issue #26 root cause: previously each Claude CLI subprocess did its own
// read-modify-write of index.json. When two jobs ran in parallel they
// stomped each other and only the last write survived, so earlier topics
// disappeared from the index even though their data file was on disk.
//
// Fix: the CLI is now instructed not to touch index.json. After each job
// completes, the server calls updateIndex(...) here, which serialises all
// updates through a promise-chain mutex.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { log } from './job-logger';

interface IndexEntry {
  slug: string;
  topic: string;
  createdAt: string;
  updatedAt?: string;
}

interface IndexFile {
  topics: IndexEntry[];
}

const INDEX_PATH = path.join(process.cwd(), 'public', 'data', 'index.json');

// Promise-chain mutex: each call awaits the previous one, regardless of
// whether it resolved or rejected, so we never overlap a read-modify-write.
let queue: Promise<void> = Promise.resolve();

export interface UpdateIndexParams {
  slug: string;
  topic: string;
  isUpdate?: boolean;
  jobId?: string;
}

export function updateIndex(params: UpdateIndexParams): Promise<void> {
  const run = async (): Promise<void> => {
    const { slug, topic, isUpdate, jobId } = params;
    const startedAt = Date.now();

    const dataDir = path.dirname(INDEX_PATH);
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    let index: IndexFile = { topics: [] };
    if (existsSync(INDEX_PATH)) {
      try {
        const raw = readFileSync(INDEX_PATH, 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        if (
          parsed && typeof parsed === 'object' &&
          Array.isArray((parsed as IndexFile).topics)
        ) {
          index = parsed as IndexFile;
        } else {
          log('warn', 'index.shape_invalid', { jobId, path: INDEX_PATH });
        }
      } catch (e) {
        log('error', 'index.read_failed', { jobId, error: String(e), path: INDEX_PATH });
        // Don't silently lose the file — bail rather than overwrite with [].
        throw e;
      }
    }

    const now = new Date().toISOString();
    const existingIdx = index.topics.findIndex(t => t.slug === slug);

    if (existingIdx >= 0) {
      const prev = index.topics[existingIdx];
      index.topics[existingIdx] = {
        slug,
        topic,
        createdAt: prev.createdAt ?? now,
        updatedAt: now,
      };
      log('info', 'index.update', {
        jobId, slug, topic, action: 'replace', total: index.topics.length,
      });
    } else {
      const entry: IndexEntry = { slug, topic, createdAt: now };
      if (isUpdate) entry.updatedAt = now;
      index.topics.push(entry);
      log('info', 'index.update', {
        jobId, slug, topic, action: 'append', total: index.topics.length,
      });
    }

    try {
      writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
      log('info', 'index.write', {
        jobId, slug, total: index.topics.length, durationMs: Date.now() - startedAt,
      });
    } catch (e) {
      log('error', 'index.write_failed', { jobId, slug, error: String(e) });
      throw e;
    }
  };

  const next = queue.then(run, run);
  // Swallow rejection on the chain so a single failure doesn't poison every
  // subsequent updateIndex call. The original promise still rejects to the
  // caller.
  queue = next.catch(() => {});
  return next;
}

/** Remove a slug from index.json. Goes through the same mutex as updateIndex. */
export function removeFromIndex(slug: string): Promise<void> {
  const run = async (): Promise<void> => {
    if (!existsSync(INDEX_PATH)) return;
    try {
      const raw = readFileSync(INDEX_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as IndexFile;
      if (!Array.isArray(parsed.topics)) return;
      const before = parsed.topics.length;
      parsed.topics = parsed.topics.filter(t => t.slug !== slug);
      if (parsed.topics.length === before) {
        log('info', 'index.remove_noop', { slug });
        return;
      }
      writeFileSync(INDEX_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
      log('info', 'index.remove', { slug, total: parsed.topics.length });
    } catch (e) {
      log('error', 'index.remove_failed', { slug, error: String(e) });
      throw e;
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
