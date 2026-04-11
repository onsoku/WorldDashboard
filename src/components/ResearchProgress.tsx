import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Globe, BookOpen, Brain, FileOutput, AlertCircle, Rocket } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';

interface LogEntry {
  timestamp: string;
  message: string;
  phase: 'start' | 'web-search' | 'paper-search' | 'synthesis' | 'writing' | 'done' | 'error';
}

interface ResearchProgressProps {
  jobId: string;
  topic: string;
  startedAt: string;
  onComplete: (slug?: string) => void;
  onError: (message: string) => void;
}

const PHASE_ICON: Record<string, typeof Globe> = {
  start: Rocket, 'web-search': Globe, 'paper-search': BookOpen,
  synthesis: Brain, writing: FileOutput, done: CheckCircle, error: AlertCircle,
};

export function ResearchProgress({ jobId, topic, startedAt, onComplete, onError }: ResearchProgressProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'running' | 'completed' | 'error'>('running');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/research/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setLogs(data.logs ?? []);
        setStatus(data.status);
        if (data.status === 'completed') { clearInterval(interval); onComplete(data.slug); }
        else if (data.status === 'error') { clearInterval(interval); onError(data.message ?? ''); }
      } catch { /* retry */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId, onComplete, onError]);

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
              <span className={`text-xs leading-relaxed ${
                log.phase === 'error' ? '' : log.phase === 'done' ? 'font-medium' : isLatest ? 'theme-text' : 'theme-text-muted'
              }`} style={log.phase === 'error' ? { color: 'var(--color-error)' } : log.phase === 'done' ? { color: 'var(--color-success)' } : undefined}>
                {log.message}
              </span>
            </div>
          );
        })}
      </div>

      {status === 'running' && (
        <div className="w-full rounded-full h-1 overflow-hidden theme-bg-progress">
          <div className="h-1 rounded-full animate-pulse" style={{ width: '100%', backgroundColor: 'var(--color-primary)' }} />
        </div>
      )}
    </div>
  );
}
