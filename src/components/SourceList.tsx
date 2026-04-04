import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { WebSource, AcademicPaper } from '@/types/research';
import { WebSourceCard } from './WebSourceCard';
import { PaperCard } from './PaperCard';

interface SourceListProps {
  webSources: WebSource[];
  academicPapers: AcademicPaper[];
}

type TabType = 'web' | 'papers';
type SortType = 'default' | 'citations';

export function SourceList({ webSources, academicPapers }: SourceListProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabType>('papers');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortType>('citations');

  const filteredWeb = webSources.filter(s =>
    s.title.toLowerCase().includes(filter.toLowerCase()) ||
    s.snippet.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredPapers = academicPapers
    .filter(p =>
      p.title.toLowerCase().includes(filter.toLowerCase()) ||
      (p.abstract ?? '').toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => sort === 'citations' ? b.citationCount - a.citationCount : 0);

  return (
    <div className="theme-bg-card rounded-lg border theme-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <button onClick={() => setTab('papers')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'papers' ? 'theme-primary-light theme-primary-text font-medium' : 'theme-text-secondary hover:theme-bg-hover'
            }`}>
            {t('sources.papersTab')} ({academicPapers.length})
          </button>
          <button onClick={() => setTab('web')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'web' ? 'theme-primary-light theme-primary-text font-medium' : 'theme-text-secondary hover:theme-bg-hover'
            }`}>
            {t('sources.webTab')} ({webSources.length})
          </button>
        </div>
        {tab === 'papers' && (
          <select value={sort} onChange={e => setSort(e.target.value as SortType)}
            className="text-xs border theme-border rounded-md px-2 py-1 theme-bg-input theme-text-secondary">
            <option value="citations">{t('sources.sortCitations')}</option>
            <option value="default">{t('sources.sortDefault')}</option>
          </select>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted" />
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder={t('sources.searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2 text-sm border theme-border rounded-md theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring" />
      </div>

      <div className="space-y-3">
        {tab === 'web' ? (
          filteredWeb.length > 0 ? filteredWeb.map((s, i) => <WebSourceCard key={i} source={s} />)
            : <p className="text-sm theme-text-muted text-center py-4">{t('sources.noWeb')}</p>
        ) : (
          filteredPapers.length > 0 ? filteredPapers.map(p => <PaperCard key={p.paperId} paper={p} />)
            : <p className="text-sm theme-text-muted text-center py-4">{t('sources.noPapers')}</p>
        )}
      </div>
    </div>
  );
}
