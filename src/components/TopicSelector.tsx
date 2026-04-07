import { RefreshCw, Search, Plus, Upload } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { TopicEntry } from '@/types/research';
import { useTranslation } from '@/i18n/useTranslation';
import { useSettings } from '@/context/SettingsContext';
import { JobQueue } from './JobQueue';

interface TopicSelectorProps {
  topics: TopicEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onRefresh: () => void;
  drilldownRequest?: { topic: string; parentSlug: string } | null;
  onDrilldownConsumed?: () => void;
  onImport?: (file: File) => void;
  updateRequest?: { topic: string; slug: string } | null;
  onUpdateConsumed?: () => void;
  translateRequest?: { sourceSlug: string; targetLang: string } | null;
  onTranslateConsumed?: () => void;
}

interface ActiveJob {
  jobId: string;
  topic: string;
  startedAt: string;
}

export function TopicSelector({ topics, selectedSlug, onSelect, onRefresh, drilldownRequest, onDrilldownConsumed, onImport, updateRequest, onUpdateConsumed, translateRequest, onTranslateConsumed }: TopicSelectorProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [filter, setFilter] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const filtered = topics.filter(tp =>
    tp.topic.toLowerCase().includes(filter.toLowerCase())
  );

  const handleJobComplete = useCallback((jobId: string) => {
    setActiveJobs(prev => prev.filter(j => j.jobId !== jobId));
    onRefresh();
  }, [onRefresh]);

  const handleJobError = useCallback((_jobId: string, _message: string) => { }, []);

  const handleJobDismiss = useCallback((jobId: string) => {
    setActiveJobs(prev => prev.filter(j => j.jobId !== jobId));
  }, []);

  const startResearch = useCallback(async (topic: string, opts?: { parentSlug?: string; mode?: string; slug?: string }) => {
    if (!topic.trim()) return;
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          language: settings.language,
          parentSlug: opts?.parentSlug,
          mode: opts?.mode,
          slug: opts?.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? 'Failed'); return; }
      setActiveJobs(prev => [...prev, { jobId: data.jobId, topic: topic.trim(), startedAt: new Date().toISOString() }]);
      setNewTopic('');
    } catch { alert('Connection failed'); }
  }, [settings.language]);

  const handleStartResearch = () => { startResearch(newTopic); };

  useEffect(() => {
    if (drilldownRequest) {
      startResearch(drilldownRequest.topic, { parentSlug: drilldownRequest.parentSlug });
      onDrilldownConsumed?.();
    }
  }, [drilldownRequest, startResearch, onDrilldownConsumed]);

  useEffect(() => {
    if (updateRequest) {
      startResearch(updateRequest.topic, { mode: 'update', slug: updateRequest.slug });
      onUpdateConsumed?.();
    }
  }, [updateRequest, startResearch, onUpdateConsumed]);

  const startTranslate = useCallback(async (sourceSlug: string, targetLang: string) => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSlug, targetLang }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? 'Failed'); return; }
      setActiveJobs(prev => [...prev, { jobId: data.jobId, topic: data.topic, startedAt: new Date().toISOString() }]);
    } catch { alert('Connection failed'); }
  }, []);

  useEffect(() => {
    if (translateRequest) {
      startTranslate(translateRequest.sourceSlug, translateRequest.targetLang);
      onTranslateConsumed?.();
    }
  }, [translateRequest, startTranslate, onTranslateConsumed]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={onRefresh} className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors theme-primary-light theme-primary-text hover:theme-bg-active">
            <RefreshCw className="w-3.5 h-3.5" /> {t('sidebar.refresh')}
          </button>
          <button onClick={() => setShowNewForm(!showNewForm)}
            className={`flex items-center justify-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${showNewForm ? 'theme-primary text-white' : 'theme-primary-light theme-primary-text hover:theme-bg-active'}`}>
            <Plus className="w-3.5 h-3.5" /> {t('sidebar.new')}
          </button>
          {onImport && (
            <>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
              <button onClick={() => fileInputRef.current?.click()} title={t('import.button')}
                className="flex items-center justify-center p-1.5 text-sm rounded-md transition-colors theme-primary-light theme-primary-text hover:theme-bg-active">
                <Upload className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {showNewForm && (
          <div className="theme-bg-active rounded-lg p-3 space-y-2">
            <input type="text" value={newTopic} onChange={e => setNewTopic(e.target.value)}
              placeholder={t('sidebar.inputPlaceholder')}
              className="w-full px-3 py-1.5 text-sm border theme-border rounded-md theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring"
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              onKeyDown={e => { if (e.key === 'Enter' && !composingRef.current) handleStartResearch(); }} />
            <button onClick={handleStartResearch} disabled={!newTopic.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-white theme-primary rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-90">
              <Search className="w-3.5 h-3.5" /> {t('sidebar.startResearch')}
            </button>
          </div>
        )}

        <JobQueue
          jobs={activeJobs}
          onJobComplete={handleJobComplete}
          onJobError={handleJobError}
          onDismiss={handleJobDismiss}
        />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 theme-text-muted" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder={t('sidebar.searchTopics')}
            className="w-full pl-8 pr-3 py-1.5 text-sm border theme-border rounded-md theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto"
        onDragOver={e => { if (onImport) { e.preventDefault(); setIsDragOver(true); } }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f && f.name.endsWith('.json') && onImport) onImport(f);
        }}
        style={isDragOver ? { outline: '2px dashed var(--color-primary)', outlineOffset: '-2px' } : undefined}>
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
