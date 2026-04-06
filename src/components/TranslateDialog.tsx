import { useState } from 'react';
import { Languages, X } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { Language } from '@/context/SettingsContext';

interface TranslateDialogProps {
  contentLang?: string;
  onTranslate: (targetLang: string) => void;
  onClose: () => void;
}

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'fr', label: 'Français' },
];

export function TranslateDialog({ contentLang, onTranslate, onClose }: TranslateDialogProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>('');

  const available = LANGUAGES.filter(l => l.code !== contentLang);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="theme-bg-card rounded-lg border theme-border shadow-xl p-6 w-80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold theme-text flex items-center gap-2">
            <Languages className="w-4 h-4" /> {t('translate.title')}
          </h3>
          <button onClick={onClose} className="p-1 rounded theme-text-muted hover:theme-bg-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="w-full px-3 py-2 text-sm border theme-border rounded-md theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring mb-4">
          <option value="">{t('translate.selectLang')}</option>
          {available.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        <button onClick={() => { if (selected) { onTranslate(selected); onClose(); } }}
          disabled={!selected}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white theme-primary rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-90">
          <Languages className="w-3.5 h-3.5" /> {t('translate.start')}
        </button>
      </div>
    </div>
  );
}
