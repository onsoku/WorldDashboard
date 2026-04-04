import { CheckCircle, Info } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { ResearchData } from '@/types/research';

interface ThemeOverviewProps {
  overview: ResearchData['overview'];
}

export function ThemeOverview({ overview }: ThemeOverviewProps) {
  const { t } = useTranslation();

  return (
    <div className="theme-bg-card rounded-lg border theme-border p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold theme-text mb-3">{t('overview.title')}</h3>
        {overview.summary.split('\n').filter(Boolean).map((paragraph, i) => (
          <p key={i} className="text-sm theme-text-secondary leading-relaxed mb-3 last:mb-0">{paragraph}</p>
        ))}
      </div>
      <div>
        <h3 className="text-lg font-semibold theme-text mb-3">{t('overview.keyFindings')}</h3>
        <ul className="space-y-2">
          {overview.keyFindings.map((finding, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              <span className="text-sm theme-text-secondary">{finding}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="theme-bg-info border theme-border-info rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 theme-text-info" />
          <div>
            <h4 className="text-sm font-medium theme-text-info mb-1">{t('overview.whyImportant')}</h4>
            <p className="text-sm theme-text-info">{overview.significance}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
