import { useState } from 'react';
import { ExternalLink, Quote, FileText, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { AcademicPaper } from '@/types/research';

interface PaperCardProps {
  paper: AcademicPaper;
  onDrilldown?: (topic: string) => void;
}

const OCHIAI_KEYS = [
  'paper.ochiai.what',
  'paper.ochiai.novelty',
  'paper.ochiai.method',
  'paper.ochiai.validation',
  'paper.ochiai.discussion',
  'paper.ochiai.next',
] as const;

export function PaperCard({ paper, onDrilldown }: PaperCardProps) {
  const { t } = useTranslation();
  const [expandAbstract, setExpandAbstract] = useState(false);
  const [expandOchiai, setExpandOchiai] = useState(false);

  const authorsDisplay = paper.authors.length > 3
    ? `${paper.authors.slice(0, 3).join(', ')} + ${paper.authors.length - 3} ${t('paper.authors.more')}`
    : paper.authors.join(', ');

  const ochiai = paper.ochiaiSummary;

  return (
    <div className="border theme-border rounded-lg p-4 hover:theme-bg-hover transition-colors">
      <div className="flex items-start justify-between gap-2">
        <a href={paper.url} target="_blank" rel="noopener noreferrer"
          className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--color-text-link)' }}>
          {paper.title} <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
        <div className="flex items-center gap-1 text-xs theme-text-muted flex-shrink-0">
          <Quote className="w-3 h-3" /> {paper.citationCount}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs theme-text-muted">
        <span>{authorsDisplay}</span>
        {paper.year && <span>{paper.year}</span>}
        {paper.venue && <span>| {paper.venue}</span>}
      </div>

      {/* Ochiai-style Summary */}
      {ochiai && (
        <div className="mt-3">
          <button onClick={() => setExpandOchiai(!expandOchiai)}
            className="flex items-center gap-1 text-xs font-medium theme-primary-text hover:underline">
            {expandOchiai ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Ochiai Summary
          </button>
          {expandOchiai && (
            <div className="mt-2 space-y-1.5 theme-bg-active rounded-md p-3">
              {OCHIAI_KEYS.map((key, i) => {
                const fields = [ochiai.what, ochiai.novelty, ochiai.method, ochiai.validation, ochiai.discussion, ochiai.next];
                const value = fields[i];
                if (!value) return null;
                const isNext = key === 'paper.ochiai.next';
                return (
                  <div key={key}>
                    <span className="text-xs font-medium theme-text">{t(key)}</span>
                    <p className="text-xs theme-text-secondary mt-0.5">{value}</p>
                    {isNext && onDrilldown && (
                      <button onClick={() => onDrilldown(value)}
                        className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-md transition-colors hover:opacity-80"
                        style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                        <Search className="w-3 h-3" /> {t('drilldown.researchThis')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Abstract */}
      {paper.abstract && !ochiai && (
        <div className="mt-2">
          <p className="text-sm theme-text-secondary">
            {expandAbstract ? paper.abstract : paper.abstract.slice(0, 150)}
            {paper.abstract.length > 150 && (
              <button onClick={() => setExpandAbstract(!expandAbstract)}
                className="ml-1 hover:underline" style={{ color: 'var(--color-text-link)' }}>
                {expandAbstract ? t('paper.less') : `...${t('paper.more')}`}
              </button>
            )}
          </p>
        </div>
      )}

      {paper.openAccessPdfUrl && (
        <a href={paper.openAccessPdfUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs px-2.5 py-1 rounded-md"
          style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
          <FileText className="w-3 h-3" /> {t('paper.openPdf')}
        </a>
      )}
    </div>
  );
}
