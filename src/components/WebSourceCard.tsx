import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { WebSource } from '@/types/research';

interface WebSourceCardProps {
  source: WebSource;
}

const TYPE_BADGE_KEYS: Record<string, string> = {
  news: 'source.news', blog: 'source.blog', organization: 'source.organization',
  government: 'source.government', encyclopedia: 'source.encyclopedia', other: 'source.other',
};

export function WebSourceCard({ source }: WebSourceCardProps) {
  const { t } = useTranslation();

  return (
    <div className="border theme-border rounded-lg p-4 hover:theme-bg-hover transition-colors">
      <div className="flex items-start justify-between gap-2">
        <a href={source.url} target="_blank" rel="noopener noreferrer"
          className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--color-text-link)' }}>
          {source.title} <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 theme-bg-active theme-text-secondary">
          {t(TYPE_BADGE_KEYS[source.sourceType] ?? 'source.other')}
        </span>
      </div>
      <p className="text-sm theme-text-secondary mt-2 line-clamp-2">{source.snippet}</p>
    </div>
  );
}
