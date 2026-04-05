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

function Dashboard() {
  const { topics, selectedSlug, currentData, isLoading, error, refreshTopics, selectTopic } = useResearchData();
  const { t } = useTranslation();

  const sidebar = (
    <TopicSelector
      topics={topics}
      selectedSlug={selectedSlug}
      onSelect={selectTopic}
      onRefresh={refreshTopics}
    />
  );

  return (
    <Layout sidebar={sidebar} topicName={currentData?.meta.topic}>
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
            <ThemeOverview overview={currentData.overview} />
          )}
          {currentData.keywords && currentData.keywords.length > 0 && (
            <KeywordMap keywords={currentData.keywords} />
          )}
          {((currentData.webSources && currentData.webSources.length > 0) ||
            (currentData.academicPapers && currentData.academicPapers.length > 0)) && (
            <SourceList
              webSources={currentData.webSources ?? []}
              academicPapers={currentData.academicPapers ?? []}
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
