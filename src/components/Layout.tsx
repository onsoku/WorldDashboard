import type { ReactNode } from 'react';
import { BookOpen, Download, RefreshCw, Languages, FileDown, Loader2, ListTodo } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import { SettingsPanel } from './SettingsPanel';
import { APP_VERSION } from '@/version';

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  topicName?: string;
  onExport?: () => void;
  onExportPdf?: () => void;
  onUpdate?: () => void;
  onTranslate?: () => void;
  runningJobCount?: number;
  unseenJobCount?: number;
  onOpenJobHistory?: () => void;
}

export function Layout({ sidebar, children, topicName, onExport, onExportPdf, onUpdate, onTranslate, runningJobCount = 0, unseenJobCount = 0, onOpenJobHistory }: LayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen theme-bg">
      <aside className="w-72 flex-shrink-0 border-r theme-border theme-bg-sidebar flex flex-col">
        <div className="p-4 border-b theme-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-lg font-bold theme-text">{t('app.title')}</h1>
            <span className="text-xs theme-text-muted">v{APP_VERSION}</span>
          </div>
          <p className="text-xs theme-text-muted mt-1">{t('app.subtitle')}</p>
          {onOpenJobHistory && (
            <button
              onClick={onOpenJobHistory}
              className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md theme-bg-card hover:theme-bg-hover border theme-border transition-colors"
              title={t('jobs.history')}
            >
              {runningJobCount > 0 ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              ) : (
                <ListTodo className="w-3.5 h-3.5 flex-shrink-0 theme-text-muted" />
              )}
              <span className="flex-1 text-left theme-text">
                {runningJobCount > 0
                  ? t('jobs.runningCount').replace('{n}', String(runningJobCount))
                  : t('jobs.history')}
              </span>
              {unseenJobCount > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                >
                  {unseenJobCount}
                </span>
              )}
            </button>
          )}
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
              {onTranslate && (
                <button onClick={onTranslate} title={t('translate.button')}
                  className="p-1.5 rounded-md theme-text-secondary hover:theme-bg-hover transition-colors">
                  <Languages className="w-4 h-4" />
                </button>
              )}
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
              {onExportPdf && (
                <button onClick={onExportPdf} title={t('pdfExport.button')}
                  className="p-1.5 rounded-md theme-text-secondary hover:theme-bg-hover transition-colors">
                  <FileDown className="w-4 h-4" />
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
