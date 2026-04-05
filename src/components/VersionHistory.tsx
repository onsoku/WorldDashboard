import { useTranslation } from '@/i18n/useTranslation';
import { AlertTriangle, Clock } from 'lucide-react';
import type { ResearchVersion } from '@/types/research';

interface VersionHistoryProps {
  versions: ResearchVersion[];
  currentVersion: number;
  onSelectVersion: (version: number | null) => void;
  selectedVersion: number | null;
}

export function VersionHistory({ versions, currentVersion, onSelectVersion, selectedVersion }: VersionHistoryProps) {
  const { t } = useTranslation();

  // Find corrections in the latest version (current data)
  const latestCorrections = versions.length > 0
    ? versions[versions.length - 1].corrections
    : undefined;

  return (
    <div className="theme-bg-card rounded-lg border theme-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold theme-text flex items-center gap-2">
          <Clock className="w-4 h-4" /> {t('version.history')}
        </h3>
        <span className="text-xs theme-text-muted">
          {t('version.total')}: {versions.length + 1}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => onSelectVersion(null)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            selectedVersion === null
              ? 'theme-primary text-white'
              : 'theme-primary-light theme-primary-text hover:theme-bg-active'
          }`}>
          v{currentVersion} ({t('version.latest')})
        </button>
        {[...versions].reverse().map(v => (
          <button key={v.version}
            onClick={() => onSelectVersion(v.version)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              selectedVersion === v.version
                ? 'theme-primary text-white'
                : 'theme-primary-light theme-primary-text hover:theme-bg-active'
            }`}>
            v{v.version}
            <span className="ml-1 theme-text-muted">
              ({new Date(v.createdAt).toLocaleDateString()})
            </span>
          </button>
        ))}
      </div>

      {latestCorrections && latestCorrections.length > 0 && selectedVersion === null && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold theme-text flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
            {t('version.corrections')}
          </h4>
          {latestCorrections.map((c, i) => (
            <div key={i} className="text-xs border theme-border rounded-md p-2" style={{ backgroundColor: 'var(--color-bg-active)' }}>
              <div className="font-medium theme-text">{c.target}</div>
              <div className="theme-text-muted mt-1">
                <span style={{ textDecoration: 'line-through' }}>{c.old}</span>
              </div>
              <div className="theme-text-secondary mt-0.5">{c.new}</div>
              <div className="theme-text-muted mt-0.5 italic">{c.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
