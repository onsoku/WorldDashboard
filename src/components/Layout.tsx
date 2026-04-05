import type { ReactNode } from 'react';
import { BookOpen, Download, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import { SettingsPanel } from './SettingsPanel';

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  topicName?: string;
  onExport?: () => void;
  onUpdate?: () => void;
}

export function Layout({ sidebar, children, topicName, onExport, onUpdate }: LayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen theme-bg">
      <aside className="w-72 flex-shrink-0 border-r theme-border theme-bg-sidebar flex flex-col">
        <div className="p-4 border-b theme-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-lg font-bold theme-text">{t('app.title')}</h1>
          </div>
          <p className="text-xs theme-text-muted mt-1">{t('app.subtitle')}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebar}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {topicName && (
          <header className="sticky top-0 z-10 theme-bg-header backdrop-blur border-b theme-border px-6 py-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold theme-text">{topicName}</h2>
            <div className="flex items-center gap-2">
              {onUpdate && (
                <button onClick={onUpdate} title={t('update.button')}
                  className="p-1.5 rounded-md theme-text-secondary hover:theme-bg-hover transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              {onExport && (
                <button onClick={onExport} title={t('export.button')}
                  className="p-1.5 rounded-md theme-text-secondary hover:theme-bg-hover transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              )}
              <SettingsPanel />
            </div>
          </header>
        )}
        {!topicName && (
          <header className="sticky top-0 z-10 theme-bg-header backdrop-blur border-b theme-border px-6 py-3 flex items-center justify-end">
            <SettingsPanel />
          </header>
        )}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
