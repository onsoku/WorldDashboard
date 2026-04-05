import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from '@/i18n/useTranslation';
import type { KeywordEntry } from '@/types/research';

interface KeywordMapProps {
  keywords: KeywordEntry[];
  onDrilldown?: (term: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  concept: '#6366f1',
  method: '#10b981',
  technology: '#f59e0b',
  entity: '#f43f5e',
  outcome: '#0ea5e9',
};

interface TreemapContentProps {
  x: number; y: number; width: number; height: number; name: string; category: string;
  onDrilldown?: (term: string) => void;
}

function CustomContent({ x, y, width, height, name, category, onDrilldown }: TreemapContentProps) {
  if (width < 40 || height < 20) return null;
  return (
    <g style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
       onClick={() => onDrilldown?.(name)}>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={CATEGORY_COLORS[category] ?? '#94a3b8'} fillOpacity={0.85} stroke="var(--color-bg)" strokeWidth={2} />
      {width > 50 && height > 28 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central"
          fill="#fff" fontSize={Math.min(14, Math.max(10, width / 8))} fontWeight={500}
          style={{ pointerEvents: 'none' }}>
          {name.length > width / 8 ? name.slice(0, Math.floor(width / 8)) + '\u2026' : name}
        </text>
      )}
    </g>
  );
}

interface TooltipPayloadItem {
  payload: { name: string; size: number; category: string; relatedTerms: string[] };
}

function CustomTooltip({ active, payload, t, hasDrilldown }: { active?: boolean; payload?: TooltipPayloadItem[]; t: (k: string) => string; hasDrilldown?: boolean }) {
  if (!active || !payload?.[0]) return null;
  const { name, size, category, relatedTerms } = payload[0].payload;
  const catKey = `keywords.${category}` as const;
  return (
    <div className="theme-bg-card border theme-border rounded-lg shadow-lg p-3 max-w-xs">
      <div className="font-medium theme-text">{name}</div>
      <div className="text-xs theme-text-muted mt-1">
        {t('keywords.category')}: {t(catKey)} | {t('keywords.relevance')}: {size}
      </div>
      {relatedTerms.length > 0 && (
        <div className="text-xs theme-text-secondary mt-2">{t('keywords.related')}: {relatedTerms.join(', ')}</div>
      )}
      {hasDrilldown && (
        <div className="text-xs mt-2 font-medium" style={{ color: 'var(--color-primary)' }}>{t('drilldown.clickToResearch')}</div>
      )}
    </div>
  );
}

export function KeywordMap({ keywords, onDrilldown }: KeywordMapProps) {
  const { t } = useTranslation();
  const data = keywords.map(k => ({ name: k.term, size: k.relevance, category: k.category, relatedTerms: k.relatedTerms }));
  const categories = [...new Set(keywords.map(k => k.category))];

  return (
    <div className="theme-bg-card rounded-lg border theme-border p-6">
      <h3 className="text-lg font-semibold theme-text mb-4">{t('keywords.title')}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" aspectRatio={4 / 3}
            content={<CustomContent x={0} y={0} width={0} height={0} name="" category="" onDrilldown={onDrilldown} />}>
            <Tooltip content={<CustomTooltip t={t} hasDrilldown={!!onDrilldown} />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        {categories.map(cat => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#94a3b8' }} />
            <span className="text-xs theme-text-secondary">{t(`keywords.${cat}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
