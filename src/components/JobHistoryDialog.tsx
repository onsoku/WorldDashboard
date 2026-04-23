import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import { ResearchProgress } from './ResearchProgress';
import type { JobRecord } from '@/hooks/useJobs';

interface JobHistoryDialogProps {
  jobs: JobRecord[];
  onClose: () => void;
  onDismiss: (jobId: string) => void;
  onRestore: (jobId: string) => void;
  onClearAll: () => void;
  dismissedIds: Set<string>;
  onOpenTopic?: (slug: string) => void;
}

type Tab = 'running' | 'completed' | 'error' | 'all';

export function JobHistoryDialog({ jobs, onClose, onDismiss, onRestore, onClearAll, dismissedIds, onOpenTopic }: JobHistoryDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('running');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const running = jobs.filter(j => j.status === 'running');
  const completed = jobs.filter(j => j.status === 'completed');
  const errors = jobs.filter(j => j.status === 'error');

  const filtered =
    tab === 'running' ? running
    : tab === 'completed' ? completed
    : tab === 'error' ? errors
    : jobs;

  const toggle = (jobId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const tabs: { id: Tab; label: string; count: number; color?: string }[] = [
    { id: 'running', label: t('jobs.tab.running'), count: running.length, color: 'var(--color-primary)' },
    { id: 'completed', label: t('jobs.tab.completed'), count: completed.length, color: 'var(--color-success)' },
    { id: 'error', label: t('jobs.tab.error'), count: errors.length, color: 'var(--color-error)' },
    { id: 'all', label: t('jobs.tab.all'), count: jobs.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="theme-bg rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border theme-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b theme-border">
          <h2 className="text-lg font-semibold theme-text">{t('jobs.history')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:theme-bg-hover theme-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-4 pt-3 border-b theme-border overflow-x-auto">
          {tabs.map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`px-3 py-1.5 text-sm rounded-t-md transition-colors whitespace-nowrap ${
                tab === tb.id ? 'theme-bg-active font-medium' : 'theme-text-muted hover:theme-bg-hover'
              }`}
              style={tab === tb.id && tb.color ? { color: tb.color } : undefined}
            >
              {tb.label} ({tb.count})
            </button>
          ))}
          <div className="ml-auto">
            {(completed.length > 0 || errors.length > 0) && (
              <button
                onClick={onClearAll}
                title={t('jobs.clearAll')}
                className="p-1.5 rounded theme-text-muted hover:theme-bg-hover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="py-12 text-center theme-text-muted text-sm">{t('jobs.empty')}</p>
          ) : (
            filtered.map(job => {
              const isDismissed = dismissedIds.has(job.jobId);
              const isExpanded = expanded.has(job.jobId);
              const StatusIcon =
                job.status === 'running' ? Loader2
                : job.status === 'completed' ? CheckCircle
                : AlertCircle;
              const statusColor =
                job.status === 'running' ? 'var(--color-primary)'
                : job.status === 'completed' ? 'var(--color-success)'
                : 'var(--color-error)';

              return (
                <div
                  key={job.jobId}
                  className={`border theme-border rounded-lg overflow-hidden ${isDismissed ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2 px-3 py-2 theme-bg-card">
                    <button onClick={() => toggle(job.jobId)} className="theme-text-muted hover:theme-text">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <StatusIcon
                      className={`w-4 h-4 flex-shrink-0 ${job.status === 'running' ? 'animate-spin' : ''}`}
                      style={{ color: statusColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium theme-text truncate">{job.topic}</div>
                      <div className="text-xs theme-text-muted">
                        {new Date(job.startedAt).toLocaleString()}
                        {job.mode && job.mode !== 'research' && ` • ${job.mode}`}
                      </div>
                    </div>
                    {job.status === 'completed' && job.slug && onOpenTopic && (
                      <button
                        onClick={() => { onOpenTopic(job.slug!); onClose(); }}
                        className="text-xs px-2 py-1 rounded theme-primary-light theme-primary-text hover:theme-bg-active"
                      >
                        {t('jobs.open')}
                      </button>
                    )}
                    {job.status !== 'running' && (
                      isDismissed ? (
                        <button
                          onClick={() => onRestore(job.jobId)}
                          className="text-xs px-2 py-1 rounded theme-text-muted hover:theme-bg-hover"
                        >
                          {t('jobs.restore')}
                        </button>
                      ) : (
                        <button
                          onClick={() => onDismiss(job.jobId)}
                          title={t('jobs.dismiss')}
                          className="p-1 rounded theme-text-muted hover:theme-bg-hover"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                  {isExpanded && (
                    <ResearchProgress
                      status={job.status}
                      logs={job.logs}
                      startedAt={job.startedAt}
                      completedAt={job.completedAt}
                      message={job.message}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
