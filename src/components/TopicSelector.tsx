import { RefreshCw, Search, Plus } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { TopicEntry } from '@/types/research';
import { useTranslation } from '@/i18n/useTranslation';
import { useSettings } from '@/context/SettingsContext';
import { ResearchProgress } from './ResearchProgress';

interface TopicSelectorProps {
  topics: TopicEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onRefresh: () => void;
}

interface ActiveJob {
  jobId: string;
  topic: string;
  startedAt: string;
}

export function TopicSelector({ topics, selectedSlug, onSelect, onRefresh }: TopicSelectorProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [filter, setFilter] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);

  const filtered = topics.filter(tp =>
    tp.topic.toLowerCase().includes(filter.toLowerCase())
  );

  const handleComplete = useCallback(() => {
    setActiveJob(null);
    setNewTopic('');
    onRefresh();
  }, [onRefresh]);

  const handleError = useCallback((_message: string) => { }, []);

  const handleStartResearch = async () => {
    const topic = newTopic.trim();
    if (!topic || activeJob) return;
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? 'Failed'); return; }
      setActiveJob({ jobId: data.jobId, topic, startedAt: new Date().toISOString() });
    } catch { alert('Connection failed'); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={onRefresh} className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors theme-primary-light theme-primary-text hover:theme-bg-active">
            <RefreshCw className="w-3.5 h-3.5" /> {t('sidebar.refresh')}
          </button>
          <button onClick={() => setShowNewForm(!showNewForm)} disabled={!!activeJob}
            className={`flex items-center justify-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-40 ${showNewForm ? 'theme-primary text-white' : 'theme-primary-light theme-primary-text hover:theme-bg-active'}`}>
            <Plus className="w-3.5 h-3.5" /> {t('sidebar.new')}
          </button>
        </div>

        {showNewForm && !activeJob && (
          <div className="theme-bg-active rounded-lg p-3 space-y-2">
            <input type="text" value={newTopic} onChange={e => setNewTopic(e.target.value)}
              placeholder={t('sidebar.inputPlaceholder')}
              className="w-full px-3 py-1.5 text-sm border theme-border rounded-md theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring"
              onKeyDown={e => { if (e.key === 'Enter') handleStartResearch(); }} />
            <button onClick={handleStartResearch} disabled={!newTopic.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-white theme-primary rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-90">
              <Search className="w-3.5 h-3.5" /> {t('sidebar.startResearch')}
            </button>
          </div>
        )}

        {activeJob && (
          <ResearchProgress jobId={activeJob.jobId} topic={activeJob.topic} startedAt={activeJob.startedAt}
            onComplete={handleComplete} onError={handleError} />
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 theme-text-muted" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder={t('sidebar.searchTopics')}
            className="w-full pl-8 pr-3 py-1.5 text-sm border theme-border rounded-md theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-sm theme-text-muted text-center whitespace-pre-line">
            {topics.length === 0 ? t('sidebar.noTopics') : t('sidebar.noMatch')}
          </p>
        ) : (
          <ul className="py-1">
            {filtered.map(tp => (
              <li key={tp.slug}>
                <button onClick={() => onSelect(tp.slug)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    tp.slug === selectedSlug
                      ? 'theme-bg-active font-medium border-r-2'
                      : 'theme-text-secondary hover:theme-bg-hover'
                  }`}
                  style={tp.slug === selectedSlug ? { color: 'var(--color-primary-text)', borderColor: 'var(--color-border-active)' } : undefined}>
                  <div className="font-medium truncate">{tp.topic}</div>
                  <div className="text-xs theme-text-muted mt-0.5">
                    {new Date(tp.createdAt).toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
