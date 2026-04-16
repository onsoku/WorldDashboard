import { useState, useMemo } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import type { TopicEntry } from '@/types/research';
import { useTranslation } from '@/i18n/useTranslation';

interface PdfExportDialogProps {
  topics: TopicEntry[];
  initialSlug?: string | null;
  onClose: () => void;
}

export function PdfExportDialog({ topics, initialSlug, onClose }: PdfExportDialogProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSlug ? [initialSlug] : []),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => topics.filter(tp => tp.topic.toLowerCase().includes(filter.toLowerCase())),
    [topics, filter],
  );

  const toggle = (slug: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(tp => next.add(tp.slug));
      return next;
    });
  };
  const clearAll = () => setSelected(new Set());

  const handleGenerate = async () => {
    if (selected.size === 0 || isGenerating) return;
    setError(null);
    setIsGenerating(true);
    try {
      // Preserve the user's selection order as it appears in the topics list.
      const slugsInOrder = topics.filter(tp => selected.has(tp.slug)).map(tp => tp.slug);
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: slugsInOrder }),
      });
      if (!res.ok) {
        let msg = `Export failed (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* non-JSON error */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? (slugsInOrder.length === 1
        ? `${slugsInOrder[0]}.pdf`
        : `encyclopedia-${slugsInOrder.length}-topics.pdf`);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="theme-bg-card rounded-lg border theme-border w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b theme-border">
          <h2 className="text-lg font-semibold theme-text">{t('pdfExport.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:theme-bg-hover theme-text-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 border-b theme-border">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={t('sidebar.searchTopics')}
            className="w-full px-3 py-1.5 text-sm border theme-border rounded-md theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring"
          />
          <div className="flex items-center justify-between text-xs theme-text-muted">
            <span>{t('pdfExport.selectedCount').replace('{n}', String(selected.size))}</span>
            <div className="flex gap-3">
              <button
                onClick={selectAllFiltered}
                className="hover:underline theme-text-link"
                disabled={filtered.length === 0}
              >
                {t('pdfExport.selectAll')}
              </button>
              <button
                onClick={clearAll}
                className="hover:underline theme-text-link"
                disabled={selected.size === 0}
              >
                {t('pdfExport.clear')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm theme-text-muted text-center">
              {t('sidebar.noMatch')}
            </p>
          ) : (
            <ul>
              {filtered.map(tp => (
                <li key={tp.slug}>
                  <label className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:theme-bg-hover">
                    <input
                      type="checkbox"
                      checked={selected.has(tp.slug)}
                      onChange={() => toggle(tp.slug)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium theme-text truncate">{tp.topic}</div>
                      <div className="text-xs theme-text-muted">
                        {new Date(tp.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="px-4 py-2 text-sm" style={{ color: 'var(--color-error)' }}>
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 p-4 border-t theme-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md theme-text-secondary hover:theme-bg-hover"
            disabled={isGenerating}
          >
            {t('pdfExport.cancel')}
          </button>
          <button
            onClick={handleGenerate}
            disabled={selected.size === 0 || isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('pdfExport.generating')}
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                {t('pdfExport.download')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
