import { useState, useEffect, useRef, useCallback } from 'react';

export interface LogEntry {
  timestamp: string;
  message: string;
  phase: 'start' | 'web-search' | 'paper-search' | 'synthesis' | 'writing' | 'done' | 'error';
}

export interface JobRecord {
  jobId: string;
  topic: string;
  status: 'running' | 'completed' | 'error';
  startedAt: string;
  completedAt?: string;
  message?: string;
  logs: LogEntry[];
  lang: string;
  mode?: 'research' | 'translate' | 'update';
  slug?: string;
}

const DISMISS_KEY = 'worldDashboard.dismissedJobs';
const POLL_MS = 2000;

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch { /* quota or unavailable */ }
}

interface UseJobsOptions {
  onJobCompleted?: (job: JobRecord) => void;
}

export function useJobs({ onJobCompleted }: UseJobsOptions = {}) {
  const [jobs, setJobs] = useState<Record<string, JobRecord>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const prevStatusRef = useRef<Record<string, 'running' | 'completed' | 'error'>>({});
  const onCompletedRef = useRef(onJobCompleted);
  onCompletedRef.current = onJobCompleted;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/research');
        if (!res.ok) return;
        const data = await res.json();
        const next: Record<string, JobRecord> = {};
        for (const [id, j] of Object.entries(data.jobs ?? {})) {
          const rec = j as Omit<JobRecord, 'jobId'>;
          next[id] = { jobId: id, ...rec };
        }
        if (cancelled) return;
        // Detect running → completed transitions to fire callback
        for (const [id, rec] of Object.entries(next)) {
          const prev = prevStatusRef.current[id];
          if (prev === 'running' && rec.status === 'completed') {
            onCompletedRef.current?.(rec);
          }
          prevStatusRef.current[id] = rec.status;
        }
        setJobs(next);
      } catch { /* network flake, retry next tick */ }
    };

    void tick();
    const interval = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const dismiss = useCallback((jobId: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(jobId);
      saveDismissed(next);
      return next;
    });
  }, []);

  const restore = useCallback((jobId: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.delete(jobId);
      saveDismissed(next);
      return next;
    });
  }, []);

  const clearAllCompleted = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev);
      for (const [id, j] of Object.entries(jobs)) {
        if (j.status !== 'running') next.add(id);
      }
      saveDismissed(next);
      return next;
    });
  }, [jobs]);

  const list = Object.values(jobs).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const running = list.filter(j => j.status === 'running');
  const completedVisible = list.filter(j => j.status === 'completed' && !dismissed.has(j.jobId));
  const errorVisible = list.filter(j => j.status === 'error' && !dismissed.has(j.jobId));

  return {
    jobs: list,
    running,
    completed: completedVisible,
    errors: errorVisible,
    runningCount: running.length,
    unseenCount: completedVisible.length + errorVisible.length,
    dismissedIds: dismissed,
    dismiss,
    restore,
    clearAllCompleted,
  };
}
