import { CheckCircle, Info } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { ResearchOverview } from '@/types/research';
import { MarkdownContent } from './MarkdownContent';

interface ThemeOverviewProps {
  overview: ResearchOverview;
  onDrilldown?: (finding: string) => void;
}

export function ThemeOverview({ overview, onDrilldown }: ThemeOverviewProps) {
  const { t } = useTranslation();

  if (!overview.summary && !overview.keyFindings?.length && !overview.significance) {
    return null;
  }

  return (
    <div className="theme-bg-card rounded-lg border theme-border p-6 space-y-6">
      {overview.summary && (
        <div>
          <h3 className="text-lg font-semibold theme-text mb-3">{t('overview.title')}</h3>
          <MarkdownContent content={overview.summary} />
        </div>
      )}
      {overview.keyFindings && overview.keyFindings.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold theme-text mb-3">{t('overview.keyFindings')}</h3>
          <ul className="space-y-2">
            {overview.keyFindings.map((finding, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                {onDrilldown ? (
                  <button onClick={() => onDrilldown(finding)}
                    className="text-sm theme-text-secondary text-left hover:underline transition-colors"
                    style={{ cursor: 'pointer' }}
                    title={t('drilldown.clickToResearch')}>
                    {finding}
                  </button>
                ) : (
                  <span className="text-sm theme-text-secondary">{finding}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {overview.significance && (
        <div className="theme-bg-info border theme-border-info rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 theme-text-info" />
            <div>
              <h4 className="text-sm font-medium theme-text-info mb-1">{t('overview.whyImportant')}</h4>
              <MarkdownContent content={overview.significance} className="theme-text-info" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
