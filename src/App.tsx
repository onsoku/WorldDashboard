import { Layout } from '@/components/Layout';
import { TopicSelector } from '@/components/TopicSelector';
import { StatsBar } from '@/components/StatsBar';
import { ThemeOverview } from '@/components/ThemeOverview';
import { KeywordMap } from '@/components/KeywordMap';
import { SourceList } from '@/components/SourceList';
import { useResearchData } from '@/hooks/useResearchData';
import { useTranslation } from '@/i18n/useTranslation';
import { SettingsProvider } from '@/context/SettingsContext';
import { Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';

function Dashboard() {
  const { topics, selectedSlug, currentData, isLoading, error, refreshTopics, selectTopic } = useResearchData();
  const { t } = useTranslation();
  const [drilldownRequest, setDrilldownRequest] = useState<{ topic: string; parentSlug: string } | null>(null);

  const handleDrilldown = useCallback((topic: string) => {
    const existing = topics.find(tp =>
      tp.topic.toLowerCase() === topic.toLowerCase()
    );
    if (existing) {
      selectTopic(existing.slug);
    } else {
      setDrilldownRequest({ topic, parentSlug: currentData?.meta.slug ?? '' });
    }
  }, [topics, selectTopic, currentData]);

  const handleExport = useCallback(() => {
    if (!currentData) return;
    const json = JSON.stringify(currentData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentData.meta.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentData]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const result = await res.json();
      if (!res.ok) { alert(result.error ?? 'Import failed'); return; }
      await refreshTopics();
      selectTopic(data.meta.slug);
    } catch { alert('Invalid JSON file'); }
  }, [refreshTopics, selectTopic]);

  const sidebar = (
    <TopicSelector
      topics={topics}
      selectedSlug={selectedSlug}
      onSelect={selectTopic}
      onRefresh={refreshTopics}
      drilldownRequest={drilldownRequest}
      onDrilldownConsumed={() => setDrilldownRequest(null)}
      onImport={handleImport}
    />
  );

  return (
    <Layout sidebar={sidebar} topicName={currentData?.meta.topic} onExport={currentData ? handleExport : undefined}>
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      )}

      {error && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      {!isLoading && !error && !currentData && (
        <div className="flex flex-col items-center justify-center py-20 theme-text-muted">
          <p className="text-lg">{t('empty.title')}</p>
          <p className="text-sm mt-2">{t('empty.description')}</p>
        </div>
      )}

      {!isLoading && !error && currentData && (
        <div className="space-y-6">
          {currentData.statistics && (
            <StatsBar
              statistics={currentData.statistics}
              keywordCount={currentData.keywords?.length ?? 0}
            />
          )}
          {currentData.overview && (
            <ThemeOverview overview={currentData.overview} onDrilldown={handleDrilldown} />
          )}
          {currentData.keywords && currentData.keywords.length > 0 && (
            <KeywordMap keywords={currentData.keywords} onDrilldown={handleDrilldown} />
          )}
          {((currentData.webSources && currentData.webSources.length > 0) ||
            (currentData.academicPapers && currentData.academicPapers.length > 0)) && (
            <SourceList
              webSources={currentData.webSources ?? []}
              academicPapers={currentData.academicPapers ?? []}
              onDrilldown={handleDrilldown}
            />
          )}
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Dashboard />
    </SettingsProvider>
  );
}
