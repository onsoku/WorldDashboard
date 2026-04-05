import { Layout } from '@/components/Layout';
import { TopicSelector } from '@/components/TopicSelector';
import { StatsBar } from '@/components/StatsBar';
import { ThemeOverview } from '@/components/ThemeOverview';
import { KeywordMap } from '@/components/KeywordMap';
import { SourceList } from '@/components/SourceList';
import { ExtensionRenderer } from '@/components/ExtensionRenderer';
import { VersionHistory } from '@/components/VersionHistory';
import { useResearchData } from '@/hooks/useResearchData';
import { useTranslation } from '@/i18n/useTranslation';
import { SettingsProvider } from '@/context/SettingsContext';
import { Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';

function Dashboard() {
  const { topics, selectedSlug, currentData, isLoading, error, refreshTopics, selectTopic } = useResearchData();
  const { t } = useTranslation();
  const [drilldownRequest, setDrilldownRequest] = useState<{ topic: string; parentSlug: string } | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

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

  const [updateRequest, setUpdateRequest] = useState<{ topic: string; slug: string } | null>(null);

  const handleUpdate = useCallback(() => {
    if (!currentData) return;
    setUpdateRequest({ topic: currentData.meta.topic, slug: currentData.meta.slug });
  }, [currentData]);

  const sidebar = (
    <TopicSelector
      topics={topics}
      selectedSlug={selectedSlug}
      onSelect={selectTopic}
      onRefresh={refreshTopics}
      drilldownRequest={drilldownRequest}
      onDrilldownConsumed={() => setDrilldownRequest(null)}
      onImport={handleImport}
      updateRequest={updateRequest}
      onUpdateConsumed={() => setUpdateRequest(null)}
    />
  );

  // Determine which version's data to display
  const versionData = selectedVersion !== null && currentData?.versions
    ? currentData.versions.find(v => v.version === selectedVersion)
    : null;
  const displayOverview = versionData?.overview ?? currentData?.overview;
  const displayKeywords = versionData?.keywords ?? currentData?.keywords;
  const displayWebSources = versionData?.webSources ?? currentData?.webSources;
  const displayPapers = versionData?.academicPapers ?? currentData?.academicPapers;
  const displayStats = versionData?.statistics ?? currentData?.statistics;
  const displayExtensions = versionData?.extensions ?? currentData?.extensions;
  const currentVersionNum = (currentData?.versions?.length ?? 0) + 1;

  return (
    <Layout sidebar={sidebar} topicName={currentData?.meta.topic} onExport={currentData ? handleExport : undefined} onUpdate={currentData ? handleUpdate : undefined}>
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
          {currentData.versions && currentData.versions.length > 0 && (
            <VersionHistory
              versions={currentData.versions}
              currentVersion={currentVersionNum}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
            />
          )}
          {displayStats && (
            <StatsBar
              statistics={displayStats}
              keywordCount={displayKeywords?.length ?? 0}
            />
          )}
          {displayOverview && (
            <ThemeOverview overview={displayOverview} onDrilldown={selectedVersion === null ? handleDrilldown : undefined} />
          )}
          {displayKeywords && displayKeywords.length > 0 && (
            <KeywordMap keywords={displayKeywords} onDrilldown={selectedVersion === null ? handleDrilldown : undefined} />
          )}
          {displayExtensions && Object.keys(displayExtensions).length > 0 && (
            <ExtensionRenderer extensions={displayExtensions} />
          )}
          {((displayWebSources && displayWebSources.length > 0) ||
            (displayPapers && displayPapers.length > 0)) && (
            <SourceList
              webSources={displayWebSources ?? []}
              academicPapers={displayPapers ?? []}
              onDrilldown={selectedVersion === null ? handleDrilldown : undefined}
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
