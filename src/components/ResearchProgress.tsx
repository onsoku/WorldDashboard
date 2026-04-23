import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Globe, BookOpen, Brain, FileOutput, AlertCircle, Rocket } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { LogEntry } from '@/hooks/useJobs';

interface ResearchProgressProps {
  status: 'running' | 'completed' | 'error';
  logs: LogEntry[];
  startedAt: string;
  completedAt?: string;
  message?: string;
}

const PHASE_ICON: Record<string, typeof Globe> = {
  start: Rocket, 'web-search': Globe, 'paper-search': BookOpen,
  synthesis: Brain, writing: FileOutput, done: CheckCircle, error: AlertCircle,
};

export function ResearchProgress({ status, logs, startedAt, completedAt, message }: ResearchProgressProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const start = new Date(startedAt).getTime();
  const end = status === 'running' ? now : (completedAt ? new Date(completedAt).getTime() : now);
  const elapsed = Math.max(0, Math.floor((end - start) / 1000));
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const timeStr = m > 0 ? `${m}m${s}s` : `${s}s`;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs theme-text-muted flex-shrink-0">{timeStr}</span>
      </div>

      {status === 'running' && logs.length === 0 && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-warning)' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('progress.starting')}
        </div>
      )}

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {logs.map((log, i) => {
          const Icon = PHASE_ICON[log.phase] ?? Globe;
          const isLatest = i === logs.length - 1 && status === 'running';
          return (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-0.5 flex-shrink-0">
                {isLatest ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-primary)' }} />
                  : log.phase === 'done' ? <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                  : log.phase === 'error' ? <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-error)' }} />
                  : <Icon className="w-3.5 h-3.5 theme-text-muted" />}
              </div>
              <span className={`text-xs leading-relaxed break-all ${
                log.phase === 'error' ? '' : log.phase === 'done' ? 'font-medium' : isLatest ? 'theme-text' : 'theme-text-muted'
              }`} style={log.phase === 'error' ? { color: 'var(--color-error)' } : log.phase === 'done' ? { color: 'var(--color-success)' } : undefined}>
                {log.message}
              </span>
            </div>
          );
        })}
      </div>

      {status === 'error' && message && (
        <div className="text-xs rounded-md p-2 break-all" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)' }}>
          <strong>{t('progress.error')}:</strong> {message}
        </div>
      )}

      {status === 'running' && (
        <div className="w-full rounded-full h-1 overflow-hidden theme-bg-progress">
          <div className="h-1 rounded-full animate-pulse" style={{ width: '100%', backgroundColor: 'var(--color-primary)' }} />
        </div>
      )}
    </div>
  );
}
