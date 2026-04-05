import { Globe, BookOpen, Tags, Calendar, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { ResearchStatistics } from '@/types/research';

interface StatsBarProps {
  statistics: ResearchStatistics;
  keywordCount: number;
}

export function StatsBar({ statistics, keywordCount }: StatsBarProps) {
  const { t } = useTranslation();

  const cards: { icon: LucideIcon; label: string; value: string | number; color: string }[] = [];

  if (statistics.totalWebSources != null) {
    cards.push({ icon: Globe, label: t('stats.webSources'), value: statistics.totalWebSources, color: 'var(--color-text-link)' });
  }
  if (statistics.totalPapers != null) {
    cards.push({ icon: BookOpen, label: t('stats.papers'), value: statistics.totalPapers, color: 'var(--color-success)' });
  }
  cards.push({ icon: Tags, label: t('stats.keywords'), value: keywordCount, color: 'var(--color-warning)' });
  if (statistics.yearRange) {
    cards.push({ icon: Calendar, label: t('stats.yearRange'), value: `${statistics.yearRange.min}\u2013${statistics.yearRange.max}`, color: 'var(--color-primary)' });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="theme-bg-card rounded-lg border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-active)' }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold theme-text">{value}</div>
              <div className="text-xs theme-text-muted">{label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
