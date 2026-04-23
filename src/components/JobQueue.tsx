import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { ResearchProgress } from './ResearchProgress';
import { useTranslation } from '@/i18n/useTranslation';
import type { JobRecord } from '@/hooks/useJobs';

interface JobQueueProps {
  jobs: JobRecord[];
  onDismiss?: (jobId: string) => void;
}

export function JobQueue({ jobs, onDismiss }: JobQueueProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (jobs.length === 0) return null;

  const toggle = (jobId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium theme-text-muted">
          {t('jobs.running')} ({jobs.length})
        </span>
      </div>
      {jobs.map(job => (
        <div key={job.jobId} className="theme-bg-card border theme-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(job.jobId)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-text hover:theme-bg-hover transition-colors"
          >
            {collapsed.has(job.jobId)
              ? <ChevronRight className="w-3 h-3 flex-shrink-0" />
              : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
            <span className="truncate flex-1 text-left">{job.topic}</span>
            {onDismiss && (
              <X className="w-3 h-3 flex-shrink-0 theme-text-muted hover:theme-text"
                onClick={e => { e.stopPropagation(); onDismiss(job.jobId); }} />
            )}
          </button>
          {!collapsed.has(job.jobId) && (
            <div className="px-1 pb-1">
              <ResearchProgress
                status={job.status}
                logs={job.logs}
                startedAt={job.startedAt}
                completedAt={job.completedAt}
                message={job.message}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
